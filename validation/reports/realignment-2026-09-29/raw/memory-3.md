# memory-3 — operator memory cache, files 151-225 (sorted)

Source: `/home/avi/.claude/projects/-home-avi-documents-work-substrate/memory/*.md | sort | sed -n '151,225p'` (75 notes, ~500KB).
Notes are read in order; findings are recorded per-note first (chronological evidence), then regrouped by problem-class key, mechanisms, principles.

## Per-note extraction (batch 1: files 151-160)

### project-teachable-capability-census-plan-2026-07-20
- 07-20 MCP<->activity isomorphism verified: MCP tools are thin HTTP clients with ActivityTask rewrites; `activityTemplate_write` via resolve_impulse creates templates (proposed defaults false); proposed templates run via `target_template_id` (bypasses Thompson).
- Executor facts: tasks run ARRAY ORDER; deps only propagate skips; unresolved placeholder -> LITERAL passthrough; bare `{{shapeName}}` never resolves. (goal-walk-floor / drafter-quality)
- Census: "2499 templates" = 3698 rows - 1198 retired; denormalized activity-row learning fields ALL DEAD (alpha=beta=1, total_executions=0); metrics/aggregate broken (templates_never_executed=-802); real evidence only in `execution` (82k rows) + activity_composition_graph (1998 edges); 88% of corpus zero executions; 1311 degenerate rows (bloat/self-nest/mitosis clones); scaffold-and-publish-vessel 1865 exec / 0 reached (largest burn). (codebase-bloat-fossils, selection-learning, write-read-mismatch)
- "Extraction is THEATER": ribosome WS path fired ZERO times ever; goal-host reach->mint skips single-template reaches; resolve_impulse calls traceless. Earn mechanism is auto-promote by exercise volume (n>=20, mean>=0.6); auto-promote consults NO validation verdict (5947/5960 promotes ignore it). (composition-crystallization, dormant-mechanism)
- Census-tick minted and auto-promoted; claim of unassisted firing CORRECTED: conductor only ENQUEUED twice; zero unassisted dispatches (load>=8 gated everything). (dormant-mechanism)
- Concepts stored != consultable: concept_select_for_prompt candidates_considered=0; /neighbors empty despite edges. (memory-recall)
- Judge misgraded 3/5 runs both directions; judge passed literal `{{...}}` as reached; fallback flipped hollow verdict with zero stored trace (failureCountReport gamed green). (false-verification)
- Drafting plane ~100% failing: draft-gap-closing 296/296, resolver-author 133/135, ribosome-extract 47/47. (drafter-quality)
- CRITIC THESIS: learning signal terminates at write-only stores — oracle labels consumed by nothing (alphaBetaDelta=[]); THREE disagreeing alphas (posterior 1/1/0 vs metrics 52.48 vs template-row 1). (write-read-mismatch)
- Credit fan-out: one reached pinned execution -> 6 credit paths, 4 broken: execution row under unicode alias; Thompson update queries bare id; impulse_shape_activity_score silent RBAC drop + `??` precedence bug; goal_execution_paths CREATE fails on NULL last_inference_confidence (ceiling-starvation root); labels write-only; posterior read lacks GROUP ALL (first-row counts). (write-read-mismatch, selection-learning)
- Fixes: dev-vessel a3f01d6 (prefix-idempotence + verified-green terminal + deterministic verbatim synthesis for patch_with_tools/feature_compose), ff416d4 judge failover; activity-api d9e48cf (NULL confidence), 1787879 (bare id), c9dd7b6 (?? precedence + RBAC) — c9dd7b6 the first fully clean zero-hands compose landing. Credit then 3/6. STILL DEAD: pathway CONSULTATION (0 recommendReachingPath on identical re-dispatch — record alive, read dead), labels->posterior.
- Edit A (poll-time label consumption) went live at runtime WITHOUT provenance via pull-sync of a staged tree; later landed properly fc297b4 goal-host. Then fires but delta empty (eager flag set).
- LLM plane: "quota death / no cascade / no funded provider" claims REFUTED 3 times — root was llmModelPolicy arms disjoint from keyed models (empty env keys) -> selectArm null -> default claude -> dead; hub funded the whole time. Fixed via shaped llmModelPolicy rev8; llm-completion-dispatch no-failover fixed d08774a; hub arm policy write not applied (reads different store). (endpoint-routing, federation-p2p, env-gating)
- P0: split-brain pull-sync closed by content-hash compare 596fd717; 6 lying vessels mirrored; drift observer structurally vacuous (hardcoded host path, 0/12 scanned). (sync-deploy-drift, dormant-mechanism)
- patch_with_tools SUCCESS-BLINDNESS: applied correct edit turn 2, typecheck passed, never emitted done (old_string prefix of new_string) -> 20 turns stacking duplicates. Zombie resolver mutated /vessels 5min past timeout. (drafter-quality)
- Gaps filed: pinned-dispatch-execution-credit-id-aliasing, thompson-posterior-read-ignores-feedback-channel, template-update-stale-cache-race, reach-judge-unresolved-placeholder-blindness, validation-cycle-inter-tick-wait-is-operator-hands, emitted-impulse-content-not-inspectable-post-hoc, hub-arm-policy-write-not-applied-selects-capped-free-model, edit-a-label-consumption-fires-but-delta-empty.

### project-teach-obsidian-interface (07-12/13)
- First no-hands autonomy criterion met 07-12: bff8313 on development-vessel origin/dev triggered purely by a gap filing.
- Staging chain 29df967 / 6e1bcc8 / 8121f3b (composer mangled `/^repos\//` into `/^\/repos\//` = silent no-op); ff80ad3 first verified substrate-authored obsidian commit.
- gap-compose pickup fired only on create + semantic reject; updates never re-queue -> fixed 9f8ab22 (gap-updates-do-not-requeue-compose).
- activity-api FTS 4-layer onion: root = NO SEARCH INDEX EXISTS; removed MATCHES. Three typecheck-clean FAVORABLE landings were behaviorally wrong — only the reproduction command told the truth. (false-verification)
- Humans-as-resolvers gap trail filed 07-13: implicit-vessels-consumer-signature-unregistered, obsidian-vault-routing-unlearned-selection (endpointForShape falls to vessels[0]), human-solicitation-activity-family-missing, goal-decline-with-reason-not-a-shaped-outcome, structural-knowledge-undervalued (595 loads, 0 successes), trace-hash-chain-absent-vs-foundation-doc, goal-host-walk-max-steps-env-gated, federation-hub-ids-double-qualified. (human-surface-escalation, docs-drift, env-gating)
- metabob-mcp concept tools 404 (route drift). (endpoint-routing)
- Skill learnability law: teachable iff decomposes onto resolver surface + trace-gradable + reaches once at ReAct floor.

### project-trace-sync-lockfree-priors (07-14)
- Design: trace ledger replicated source of truth; posteriors as per-origin G-Counter CRDT (vpm_partition own-row UPSERT). Posterior-core partitioning HELD — never landed (dormant plan).
- AET -> execution migration: execution dual-write was lossy; then SILENTLY NOT PERSISTING (frozen 3102 rows, 5.5h) because insertExecution used JWT session ($token not $auth) -> PERMISSIONS false -> silent drop. Fixed 27dca9b (root path + verify-after-insert). (trace-store-db, write-read-mismatch)
- mirror-to-live copied src/ only, not sql/ -> migrations never applied; fixed super-repo 11ec70dc. Stranded mitosis-pending.json (dead pid) jammed all pull-sync. Hub deploy opaque. (sync-deploy-drift)
- `NONE != NONE` three-valued in SurrealDB -> use `??`. (trace-store-db)
- Replication built (activity-api 3a4c045..0e128ca): pull-based anti-entropy over libp2p egress :8401; 4 bugs (import nested in .catch = dead code; datetime strings; watermark advanced on pulled not stored; overload 20x500 drain). Cadence = setInterval + env config = law-1/law-5 violation, flagged as gap. (federation-p2p, env-gating)
- Write-flip e8822c7, then 9d46962 AET decommissioned; DUAL_WRITE_ENABLED=false in /etc/substrate/env (env-gated, resets on image rebuild). Residue: trace_store_counters over-counts, db-admin names AET, E33 destructive reconcile do-not-ship. (codebase-bloat-fossils, env-gating)
- Direct-edit gate bypassed via python/Bash (hook only intercepts Edit/Write).

### project-v2v-communication-and-replication (07-13)
- 15 operator gaps filed incl vessel-selection-unlearned-registration-order, ribosome-extraction-gates-on-success-not-reached, posterior-store-split-read-ambiguity, trace-write-spool-missing-on-partition, comm-policy-env-gated-invisible, bespoke-seams-bypass-shaped-resolve, replication-not-an-activity, docs-drift-foundation-batch.
- 14/14 channels proven. Envelope drift: /resolve envelopes differ per vessel; vesselRegistry omits libp2p_multiaddr; light-dispatch accepts nonexistent template ids (207). (endpoint-routing)
- Endpoint confabulation class: drain-loop feed 657cbb7 fetched 3 nonexistent routes; fixed forward by contract injection into compose prompts 9848850 (autonomous). compose-apply-function-splice-broken (7 instances). patch_with_tools falsely reached 2x. (drafter-quality)
- Dual-registered `concept` shape routed to dev-vessel pattern miner (vessel-selection unlearned) -> pinned `_fedTargetVessel` cf62b73. (endpoint-routing)

### project-variant-minting-UNBLOCKED-2026-08-03
- ribosome-vessel/src/index.ts:153 never passed `applyExtraction` -> default false -> dispatch_write_attempt silently skipped every extraction. Landed no-hands 5f96ba4; learned template persisted 2min later; 13 learned-* minted by 03:5x. (composition-crystallization, dormant-mechanism: WORKED)
- Mislocalized first to goal-host.ts; 3 verifiers refuted. LAW: attribute dispatcher by log volume per unit.
- /templates?limit=N is a ranked window, not the store; list-embedded alpha/beta stale; /templates/:id/metrics route failed 100% (GROUP BY must name alias) fixed f5eb515 + 41e7e59. "Two observability failures made a working loop look dead." (false-verification)
- `created_at > "2026-..."` string-vs-datetime matched June rows (367 vs 13). (trace-store-db)
- variant_promote has NO implementation anywhere despite dev-vessel CLAUDE.md documenting it. (docs-drift, dormant-mechanism)

### project-vessel-maintenance-parity-gate (07-15)
- Fossil census: activities.ts 12014, goal-host index.ts 6912, impulses.ts 5686, execution-traces.ts 3717, boredom index.ts 3491, obsidian goal-dispatch-view 2546.
- Parity gate (4 deterministic checks: surface, tsc, test-parity, normalized-AST) — correctness in the deterministic gate lets the generator be weak. 3 cycles on activities.ts ea4cf1b/2a17f54/65f7fbe (12015->11118); goal-host c3fe0b7; engine.ts b5a37cc (1907->1596). Gate BLOCKED a non-closed cut (proves enforcement).
- Composed seam-extraction capability minted from prose (author_composed_capability), zero new resolvers; obstacle chain #1..#7 (validateDataTask on defaults; reuse-before-mint aliasing on generic output shape; drafter guessed wrong shape names; placeholders baked as literals; cross-resolver path-root; llm output not parsed; executor {{impulse:slot.field}} not universal). Fixes 86f35d8 + 2bbd88a9 (substrate-authored), d5562108, 1e2087a, 09dc380, 1a626c8, root ef54c05 (robust JSON hoist — prose-prefixed fenced LLM output; hand-applied). 5/5 reached (dc00c441). LESSON: 5 fixes downstream before probing the upstream resolver output.
- Self-deploy of library vessels: substrate:deploy hook (0dcf370) + restart-order race fix (58c5638). Dev-vessel cannot self-deploy its own resolvers (self-cutover no-push + selective mirror). (sync-deploy-drift)
- fs_edit snake/camel key mismatch = write-read-mismatch instance.
- boredom sampleExternalGoal (index.ts:187) parsed the wrong file shape -> external-demand pool was a no-op; fixed 48ebb26. Seam goals added to rolling-pool.json 184e2214. Detect/verify activities NOT minted (bundled in NL). Tools seam-extract.ts / parity-check.ts left as operator scaffolding in job tmp — NOT minted as activities. (dormant-mechanism)
- Debug cruft [rIS-debug] left in engine.ts. (codebase-bloat-fossils)
- dispatch-hang / in_flight leak after UNFAVORABLE; fall-through walk wanders ~15min. Multi-hunk goals UNFAVORABLE; single-hunk recipe lands.

### project-walk-posterior-starvation-fix (07-16)
- Walk Thompson selections ran with NO posteriors: transformToLegacyTemplate dropped metrics (a4ff8b2); join queried phantom table activity_metrics (e2b40c9); correlated $parent.id subqueries return nothing; empty view != error (fill from legacy variant_performance_metrics); origin tree never booted (type re-exported as value) — resolved 1e2e628 (probe 9ad2610c real alpha/beta). (selection-learning, write-read-mismatch)
- activity-api cutovers were a no-op (gap-activity-api-cutover-restarts-without-applying-source): 4 "landed+restarted" dispatches never changed /vessels; manual docker cp deploy. (sync-deploy-drift)

### reference-10h-audit-endpoint-swap-loop-returned-2026-08-03
- Failure classes down 10-90x (hollow_walklog_capped 380->0, 0-step 447->16, substrateGap_write failures 1061->17, edit-intent-no-landed-edit 392->41).
- Endpoint-swap loop returned: 4 of 6 autonomous commits thrash one line in feature-compose.ts (a74ccd7, 7ea7d52 landed literal "https://new-llm-endpoint.com", 1ad2db9 self-revert, f79fadb left `llmEndpoints[1]!` live) — fixed a11b7bb. LAW: a self-reverting loop is not self-correcting. (autonomous-regression, hollow-landing)
- FTS index build 94s + write conflict — cannot succeed in startup gate; caller fix e5a8fd5 (silent {total:0,fts:true} ended). (trace-store-db)
- concept-db 18260 unpublished on hub; deterministic:verified-* oracles 0 firings; 86% drafter traffic targets its own source file. (dormant-mechanism)
- Fetch before declaring a sha fictional.

### reference-194-dispatch-multidomain-probe-2026-08-08
- 194 dispatches, 9 families: 86.6% correct, hollow 1.5%, understated 21 (conservative verdict). Convergence largely onto shellResult (156/194). No learning curve (saturated from round 0). fs_largest 1/13 durable failure (filename answer; count-shaped verifiers do not apply). v1 z=-5.58 "decline" was purely a hub drain. (goal-walk-floor, selection-learning)

### reference-2026-08-28-findings-block
- Substrate silently reverted a verified fix 3min post-push (stale-base patch onto HEAD). Seal's escape valve asked 1755x/48h, never answerable (fixed 421052c). Concurrent Claude session reverted my landed change in 2min. Gap closure = 69% TTL expiry, 1.9% repair (1332 gaps / 914 closed / 631 expired / 17 repair-verified). Closable repair needs goal prefix `Close substrate gap <id>:`. Self-retracted refutation still counted in quorum. substrateGap_write REPLACES classification_metadata.

## Per-note extraction (batch 2: files 161-170)

### reference-2026-08-29-test-suite-repair-block (08-29)
- Suite dev-vessel 95 -> 52/41 fail over 17 commits (1814 pass/7 skip/41 fail at bbfc43b).
- Time-bomb fixtures (dates aged out of now-30d window) fixed 2cf00d1. Empty env var defeats `??` -> hostless fetch reads as empty fleet (6dd0cd3). Suite pollution via module-scope globalThis.fetch mocks (efe7cd3); combinatorial 3-file triggers; FAILING files act as polluters (5b41234 dissolved a 5->0 interaction). (test-residue-live-state)
- Checker comparing two registries is blind when both omit the same entry: cyclic_flow_scan seeded as activity but unroutable. (write-read-mismatch)
- Layout-artifact tests (fixed-depth ../) fixed 5b41234, a47e1ba, 5f06788 — the latter converted 4 artifacts into 1 TRUE POSITIVE: env_gate_fulfilled calls `/v2/substrate/gap/env-gate-fulfilled` which activity-api never mounts — advertised capability incapable of succeeding; METABOB_ENDPOINT interpolated with no fallback -> "undefined/v2/..." (endpoint-routing, dormant-mechanism)
- Operator nearly filed a FALSE ORACLE (detector must fire on two security negative-control tests) — corrected. "A wrong gap left in the store is worse than an unfiled one." (false-verification, gap-content)
- Gap store NORMALIZES gap_id (`env-gate-fulfilled-...` stored as `gap-env-gate-fulfilled`); HTTP:000 often = committed. Point read-back by supplied id is invalid. (write-read-mismatch)
- "Fail-soft keeps SHAPE, drops FIELDS": learning-mode.ts:49 returns `{error, concepts:[]}` under learningMode shape. (write-read-mismatch/false-verification)
- Tests enforcing a DELETED policy (5 instances: concept_usage_record 81eab2d, docs_align_scan 781986b, llm_api_health_observer 046a6c2, doc_drift_fix 4fe35d6, json-path-extract 046a3c5) vs tests that were RIGHT because autonomous commits regressed contracts: f365f3a (07-04, substrate) reversed "no-work is not a win" credit contract in apply_proposal_as_patch (left red, filed); eb42e0b deleted execution citation from concepts (fixed c173011). 22c6660 renamed LLM shape: readers migrated, template output_shapes declarations not (PARTIAL propagation -> hollow producer occupying selection slot). (autonomous-regression, write-read-mismatch)
- "THE TEST SUITE IS THE SUBSTRATE'S ONLY DURABLE MEMORY OF ITS OWN CONTRACTS" — 866 substrate commits all carry same template, record WHAT not WHY. Filed autonomous-landings-can-silently-remove-documented-contracts-with-no-rationale; proposal: landing template records gap summary + gate reason.
- git-status resolver ignores cwd, hardcodes `/workspace/goal-host-vessel` + master (env default). (env-gating)
- Pull-sync restarts activity-api on each push -> gap writes HTTP:000. (sync-deploy-drift)
- bun double-prints failures (106 lines for 53) — per-file rankings wrong; reconcile derived breakdowns against the tool's total.

### reference-2026-08-29-trace-instrumentation-block
- Self-dev pipeline emitted NO traces: 12h 119 composes / 191 cutovers / 579 picks vs 0 rows. Fixed 4afd4c1 + e8e3fec (softRefuse chokepoint, cutoverApplied) + c5f7efb. Still untraced: apply_proposal_as_patch, gap_to_feature, patch_with_tools. "A log is not a trace." (trace-store-db, false-verification)

### reference-2026-09-01-shipped-and-the-baseline-that-was-bimodal
- 289cf2f capacity peek: 82.5% of picks (3699/4482/48h) refused at capacity after paying for selection; composes 5.8->10/hr. Stated CPU rationale dead (0 typecheck spawns). (spend-envelope-throughput)
- b17eccd per-gap exponential backoff keyed on durable last_failed_at -> waste moved to recommit lineage within the hour; b44dcad lineage-grain backoff (sums over parent_gap_id/source_gap_id) — pick concentration broke. (narrowing-duplicates)
- Baseline bimodal (cliff 21h before deploy): mean of bimodal = baseline of neither mode.
- substrate commit 01e3dd9 deleted requeueAfterNonAttempt call at main compose path (reverting 86cdbf2). (autonomous-regression)
- Compose success 1.6%/attempt. Refuter 1/2 split passes a guaranteed TypeError.

### reference-21-percent-of-cutovers-...-destroyed-by-pull-sync-2026-09-14
- Commit a340697 cutover graded reached:true on a LOCAL sha with push_status host_sync_pending; pull-sync reset --hard origin/dev destroyed it 3min later. Headline "21%" RETRACTED: real rate 5/1206 (0.41%) — journal lines counted prints not cutovers; grep without space after colon gave false zero. Retracted claim that recommit churn (391 open recommit gaps) is downstream of commit destruction. (sync-deploy-drift, false-verification)
- `new_git_sha` IS NOT LANDING EVIDENCE; honest predicate push_status=="pushed" / is-ancestor origin/dev.
- Commit message gap attribution unreliable (names whatever proposal was processing). Drafter lesson: anchor on the statement whose behavior changes, not a declaration (vacuous-edit gate reads `_x` binding as dead).

### reference-248-gap-escalations-were-asked-of-a-vessel-no-human-reads-2026-09-22
- hopeless() seals at 8+ attempts/0 lands -> escape posts uiQuestion_write to PINNED `STATEFUL_UI_VESSEL_ENDPOINT ?? 127.0.0.1:8270` (replaced stateful-ui-vessel, active, 480 panels): 268 questions, 248 needs-human-*, 0 answered; live human-surface-vessel :8310 never reads it -> escalation_disposition_apply starved -> seal permanent. Discovery advertises 4 vessels for uiQuestion_write. (human-surface-escalation, endpoint-routing, calibration-seal, write-read-mismatch)
- A gap filed into a sealed category is escalated not composed (my own gap hopeless in 90min). Lane consumed by edit_intent_route; ui_legibility zero share despite class-Thompson allocation commit. (calibration-seal)
- Method: host :18270 dead but in-container 8270 alive — positive control at the same address.

### reference-a-400-char-truncation-...-nonexistent-edit-site-2026-09-10
- gap-to-feature.ts:2670 `.slice(0,400)` cut a path mid-extension -> edit_site `...observer.t`; feature-compose target filter `/^repos\/[\w.-]+\/.+\.\w+$/` checks shape not existence. Fixed substrate-authored 172c7f7 (examination_unexamined_files in trace), 13f7d07 (truncation guard), 48656e6 (rung 2 windowed 24h). Stored instance repaired by hand (class fix doesn't repair stored instances). (gap-content, drafter-quality)
- Semantic gate refused the correct fix because the causal link was asserted not measured — "answer a refuter with a measurement". Drafter dropped a paren (TS1005).
- Refused to window rung 3 (would flatter today) — "a metric change that cannot flatter you today is a repair; one that does is gaming". uncovered:775 fossil from reading a 25-day-stale submodule tree. (false-verification)
- Proposed law-6 detector: target-file filter must require path existence. (status unknown)

### reference-a-compose-prepended-a-hallucinated-file-and-crash-looped-the-trace-store-2026-08-11
- Drafter emitted whole-file replacement (Express in Hono vessel, nonexistent imports, gap summary as bare prose) prepended to live goal-paths.ts in /vessels -> activity-api crash loop (NRestarts 107->123). self-recovery.timer active but next_elapse=0/infinity (inert since 08-08). Content on no branch (drafted against LIVE tree). Operator restored. (autonomous-regression, dormant-mechanism, sync-deploy-drift)
- Detector bec9d8d (parse check at cutover) — recurred 2.5h later at a stage before cutover; guard at wrong stage. (hollow-landing: detector at wrong seam)
- Driving demand was PHANTOM: gap route-edit-09100637 asked for org_id already written at goal-paths.ts:589; 18 runs, 7 failure lessons; closing it: 23 picks/8min -> 0. "Nothing re-checks whether a gap is still TRUE." (gap-content, false-verification)
- Proposed: parse at write time; draft in isolated copy; refuse spec text in patch; refuse new framework import; watchdog on restart COUNT.

### reference-a-composite-index-makes-an-equality-conjunction-return-zero-rows-2026-09-10
- SurrealDB composite index answers correctly only for leading field or all-equality; strict subset -> union over empty -> 0 rows OK. Sibling: `field = X AND <datetime bound>` with a dedicated datetime index drops the equality (inflation; hid tenant-isolation failure because service connects as root). Only `time::now() - <duration>` verified safe; `d"..."` also drops. (trace-store-db)
- execution_exemplar 0 rows EVER: 4 stacked defects — boot run env-gated EXEMPLAR_SELECTOR_RUN_ON_BOOT, 24h setInterval in an 11.4-minute-mean-uptime process (126 starts/day); two index-bug queries; inserts omit selected_at (VALUE default doesn't fire on INSERT). Fixed 7c34185 + substrate commits -> 315 rows / 82 activities. `processed:101 failed:0` while receiver count=0. (dormant-mechanism, env-gating, write-read-mismatch)
- Law-6 detector: "for each store with a designated writer: is it empty while its input is non-empty?" (assertion 6 of full-cycle harness was failing in production the whole time).
- `process_start > file_mtime` is the deploy test.

### reference-a-concurrent-claude-session-edits-the-same-vessel-files-2026-08-28
- Another session (Claude-Session trailer) reverted my landed docs-align accuracy enablement 90a1e31 via 18a4e3c in 2 min, correctly: its predicate false-positived gaps into sealed documentation_drift category (23->29 gaps_emitted). Author name != actor. (docs-drift, calibration-seal)

### reference-activity-table-posteriors-are-vestigial-2026-09-08
- activity table alpha/beta never written (3904 rows at 1/1/0); canonical = variant_performance_metrics (4571 arms, beta-dominant ~3:1), context_thompson_scores (7879 rows), goal_execution_paths (10579 rows, 17.5% successful) + CI side-write, state-pattern affinity, llm-router arms = SIX belief families; never merge. (selection-learning, write-read-mismatch, codebase-bloat-fossils)

## Per-note extraction (batch 3: files 171-180)

### reference-adaptation-fires-and-the-two-donor-stores-are-different-2026-09-06
- Instrument lie in goal-host tryLexicalRebind: logs `outcome selected=no candidates=0` before the loop on every call; deletion REFUSED by fc-vacuous gate (log-only change) -> lie still live. (false-verification)
- Two tier-2 mechanisms read DIFFERENT donor stores: lexical rebind -> reachedCommandCache `/workspace/.goal-host-reached-commands.jsonl` (4633 lines, 2540 tombstones, 119 unique); pathway reuse -> goal_execution_paths.endpoint_output_shapes (backfilled). First adaptation `selected=true` observed (wc -l path swap = ground truth 1346); rephrasing refused at scaffold 0.13-0.14 vs threshold 0.15 (filed lexical-rebind-scaffold-threshold-...). Only command-shaped results bank -> fs_edit (67) and code_modification_proposal (55) ZERO donors by construction. (composition-crystallization, goal-walk-floor)
- goal_execution_paths.success None on all 9864 rows (unused field). (codebase-bloat-fossils)
- RETRACTED "ablation lever never fired": control exercised a different writer. Root: 5 tags pushed onto effectiveTags AFTER handoff to seek call (index.ts:15134/15173/15207-9) — ~13,000:1 loss. Fixed substrate 6273bf6 (hoisted ablation + learning_mode). /run-goal reads snake_case learning_mode; camelCase silently ignored -> held-out runs contaminate learner. (write-read-mismatch, selection-learning)
- learned-composition-filecontent-to-shellresult: 74 executions all success, ZERO reached, ev~0.67 posterior, selected over working path -> credit keyed to clean exit not reach. (selection-learning, hollow-landing)
- Three gate refusal classes (anchor-provenance wrong, concurrent-cutover rollback wrong, fc-vacuous defensible); none scored -> gate calibration impossible. (false-verification)

### reference-a-deterministic-fast-path-skips-the-honesty-gates-2026-08-17
- Compositional ladder hand-graded: rung 2 (arithmetic over two counts) FALSE REACH via registry fast-path oracle with alpha+2; rung 3 honest miss. Fixed routing 58376c1 (abstain on two counts / arithmetic) — NOT running on live goal-host at write time. Later closure: two-source rung valid+durable after 4 fixes (supply missing fact, extend parse to /vessels, represent scope, grade at insert). (false-verification, goal-walk-floor)
- "Adding a verifier to a class it cannot fully represent is worse than no verifier" (72 vs true 60 credited). "Writing an invariant down is not implementing it" ("if both count, abstain" recorded 08-16, never built).
- Five instrument failures in one day (registry oracle, two-source verifier, mock-completeness scanner, fleet endpoint detector `/` mount, dist grep on re-export stub, masked-runtime) -> "prove the check can fail before trusting that it passed".

### reference-a-drain-that-never-releases-is-the-same-outage-2026-08-10
- dev-vessel SIGTERM drain waited on authoring-inflight markers written only at APPLY -> composes killed mid-flight ("socket closed"); cutover-side had guarded timer path only. pull-sync deferral uses /health in_flight which dev-vessel never published. First fix counted all requests (steady 3-5) -> never 0 -> burned 240s. Corrected to count compose/patch/apply/mitosis surfaces. (sync-deploy-drift)
- Suite drifts ~15 failures run-to-run (93 then 98 same tree) — measure count variance first.

### reference-adversarial-battery-and-degenerate-honesty-2026-07-27
- 7/8 everyday goals genuinely correct; hollow registry-count on empty stdout fixed goal-host 510e0f0 (refuse command failure after retries); registry inventory via threading DISCOVERY_ENDPOINT /registry/stats into command synthesizer f486795 (+ 90ab887). (goal-walk-floor: WORKED)

### reference-advertised-vs-resolvable-is-305-of-305-2026-08-10
- Local spoke: 305 advertised / 305 resolvable / 0 orphaned, 15 healthy vessels (registration != answering; LLM arms registered but credit-dead). Probe must use vesselCapability; ordinary-shape /resolve EXECUTES the shape (first sweep scored 0/313 and would do 313 things). Cross-node control mismatch (hub 9 vs spoke 6 llm_completion). (endpoint-routing, node-locality)

### reference-a-failed-compose-truncated-the-registry-vessel-to-a-fragment-2026-08-09
- Rolled-back compose left discovery-vessel live src/index.ts truncated 23,746 -> 2,449 bytes while logging "restored 1/1 live file(s)"; unit uptime 143,366s hid it — next restart would have killed the routing fixed point. Restored by copy; no restart. warn-baseline-drift.sh (f06e1470) checks on deploy only. (autonomous-regression, sync-deploy-drift)
- LAW: a vessel healthy now can be dead on next boot.

### reference-a-failed-walks-writes-survive-its-own-verdict-2026-09-05
- Walk graded reached=false still keeps its gap-store write; gap-closing goals target substrateGap_write so writing status:closed == success (circular). Two instances destroyed evidence (3300->123 ch, 4519->62 ch; source rewritten). Closer writes goal text (truncated summary) back as summary. SATISFIER_FORBIDDEN_FS_WRITE guard (index.ts:9042) covers fs only. Architectural fix (defer write / snapshot-restore on reached=false) = operator decision, not made here. 4205/9700 learned paths (43%) are "Close substrate gap" goals; satisfier paths 85% failure. sweepPendingLandVerifications refuses to close -> 685 open; unchecked path drains. (false-verification, write-read-mismatch)

### reference-a-failure-that-looks-like-a-result-2026-08-08
- Nine "system can only X" findings were instruments: wrong namespace -> 0; coverage_progress TRUE by construction (fixed guard 1b57edc); recall AND-matched lexical (OOV token -> 0); "98.5% shellResult monoculture" tautological (real 8.4%); validation requiredPatterns never implemented; sampling decommissioned AET; lifetime aggregates read as current; own harness precondition missing; git push != deployed (3 commits stranded, pull-sync SIGKILLed at 15-min timeout, timer never re-arms). (false-verification, memory-recall, sync-deploy-drift)
- Reuse compounds TRUE (73% all-or-nothing vs 41.4% binomial, z=+20.9); 7/9 novel goals bound to cached donor. Trajectory invisible -> reach_history rollup 1150223. First reach never acquired: 72% of classes never reach; self-generated gap work 47% of execution at 6.7% reach vs 39.6% external. Convergence 2.3x above chance. (selection-learning, gap-content)
- Livelock 2018 attempts / 1 goal_hash from empty interpolation `{{extract_vessel_name_text}}`; guard 5648250. largest_file verifier problem. shape_gap_resolution diagnosed 3x wrong from code (7deef44 withdrawn 95126ff); probe 457c7a6 stranded undeployed.

### reference-a-filtered-count-can-silently-return-the-unfiltered-count-2026-09-03
- SurrealDB 2.3.3: `WHERE eq AND daterange GROUP ALL` returns unfiltered count on execution (table-dependent); GROUP BY workaround. db-admin.ts:safeCount emits this form; 82b030e fixed only alias. Gap surrealdb-group-all-drops-equality-conjunct-beside-datetime-range. (trace-store-db, false-verification)

### reference-a-fix-that-writes-a-field-nothing-reads-is-hollow-2026-09-15
- 4 of 7 inspected autonomous commits inert: 0576dbc (repair_fixed_at write, zero reads), 617ed21 (proposal_id into evaluation_evidence nobody reads), d8a5f84 (timeout_failures filter whose predicate can never match — and fix already existed in cutover; real unfixed instance feature-compose.ts:5313), c532795 (GUARD_RE line in env-gate-scan.ts 665->805 chars — corruption attractor). All typecheck-clean on origin/dev. Hollow write consumes the gap's one landing -> verifyGapCondition pending -> held forever (uiQuestion exit returns 500). (hollow-landing, false-verification, calibration-seal)
- Gate whose verdict nothing reads: feature-compose.ts:2068 fail-open (refuseWhenJudgeUnavailable).
- concept-db X-Api-Key vs Authorization: ApiKey = different scopes (4 vs 13 rows); 3 lessons written to unread scope; verified with same wrong header. compose_lesson hollow_write minted in drafter scope. Drafter corpus has covered 11 classes since 07-04; in-file comment "only ONE class reached the corpus" STALE. (memory-recall, docs-drift, write-read-mismatch)

## Per-note extraction (batch 4: files 181-190)

### reference-a-gap-closed-with-a-remedy-that-never-happened-2026-09-06
- Gap `the-walk-invents-a-file-path-for-a-fileless-gap` filed 07:01, CLOSED 07:11 with a remedy that never happened (no commit; behavior recurred 3x); detected_at placeholder 2024-01-01; source rewritten operator -> substrate. Law 7 triple measures fiction in the flattering direction. (false-verification, gap-content)
- substrateGap_write REPLACES; lanes reclassify category/source (ui_legibility -> operations/edit_intent_route) -> gap vanishes from the human surface board filtered to ui_legibility as soon as a lane touches it. Closure and visibility conflict. (human-surface-escalation, write-read-mismatch)
- Negative from a pattern built from previously-seen instances is not absence (third path prefix).

### reference-a-gap-with-a-false-premise-is-retried-forever-...-2026-09-11
- False-premise gaps (A: "X unused" but live -> TS2304; B: quoted anchor already gone -> anchor_not_found) retried forever; narrowed children inherit; read as drafter defect. 17/600 open gaps (2.8%) cite a complete anchor with zero occurrences. 7 closed by hand (route-edit-c50af498 family of 5 — close whole family, parents respawn children; e2e2e592; 40f3daa8; 2463d13c). (gap-content, narrowing-duplicates)
- Detector landed in admitActionableGaps (gap-to-feature.ts), fail-open, excludes but does not close — closure half left as follow-up. Modelled on (E2) phantom typecheck exclusion. (mechanism)
- Goal-formulation bottleneck: operator one-op edits 3/3 vs autonomous 4/26. "The drafter was obeying a clear instruction correctly. The instruction was wrong." (drafter-quality vs gap-content)
- `grep -c` prints 0 and exits 1 -> `|| echo 0` false LANDED.

### reference-a-gate-refused-multi-file-compose-can-still-land-one-files-edits-2026-09-12
- Dispatch be2fd571: UNFAVORABLE + rolled back, yet one file's edit landed as fec22cbc (pushed). Rollback not atomic across files. 4 attempts, 4 failure modes, gate right 3/4; drafter inserted unspecified declaration (TS2300). Executable payload guards adopted (anchor not in repl, no backslash, no const/let). (hollow-landing, drafter-quality)
- Probe of live learning surface: check it left nothing behind (13 arms, 0 probe arms). (test-residue-live-state)

### reference-a-git-file-a-truncated-log-and-a-reach-rate-that-is-92-percent-self-scans-2026-09-11
- git-status.ts read `.git/HEAD` as a path; in linked worktree `.git` is a file -> every isolated compose of dev-vessel failed its own integration test. Fixed 29756da. Operator called it a flake after testing only ordinary checkouts. (sync-deploy-drift/test-residue)
- appendComposeLesson has TWO writers; the JSONL writer stored raw `reason.slice(0,200)` = install preamble for 58% of verification failures (raw_excerpt on 0/2993 rows). Fixed 107a75c7 (distil at call site). "The code I was reading is not the code that writes." (write-read-mismatch, memory-recall)
- Execution-level reach 48.2% is 92% self-scan timer ticks (detect-execution_error_ribosome_extract 554, cyclic-flow scan 354, docs-decision-deliver 349, draft-gap-closing 329...). Honest goal-level reach from goal_verification_labels (4302): 5.0% overall / 2.4% edit goals. (false-verification, goal-walk-floor)
- Vacuity check reads added lines in isolation; comment-only changes categorically refused => substrate cannot repair its own documentation. (docs-drift, false-verification)
- Drafter mangle rate scales with edit size (25 lines fail twice; 9 lines + named failures + post-condition landed). (drafter-quality)
- Operator shipped regression 95d973e6 (reverted b865620b) by hashing a verification.

### reference-a-goal-phrase-matching-a-comment-decided-a-live-dispatch-2026-08-11
- Dispatch faac9a39: symptom goal localized to goal-host index.ts by phrase "traffic across" matching a COMMENT; real defect in activity-api activities.ts. Unique-hit gate cannot tell implementation from comment. Semantic gate caught it. (drafter-quality, gap-content)
- Operator fix dd1195b (exclude own-vessel hits) turned ambiguous->unique -> misroute; reverted 88b212a. "A stated risk is not a mitigated one." (directed-overshoot)
- Progress: symptom goals now reach feature_compose via 799ccb3 + 9135037.
- Needed exclusions: comments/docstrings, test files, then identifier corroboration.

### reference-a-human-filed-gap-was-closed-autonomously-in-13-minutes-2026-08-09
- Operator-filed one-line defect (autoClose default) closed autonomously in 12m59s: 04775a7 Substrate Autonomous, closed_reason landed_verified. (WORKED)
- What unblocked: `systemctl unmask gap-compose.service`. Dead chain: autonomy role absent from role groups -> unit masked; substrate-gap.ts spawned systemctl start and discarded exit code ("pickup triggered" printed every gap); watchdog stall marker compose-lessons.jsonl appended by every compose so never >20min; GapDrainObserver subscribed to HUB websocket and ignored non-dispatchable gaps. Landed b8feccd + 69d6a21 (in-process nudge) + b1c3e68, 267900a, 02b0d24. (dormant-mechanism, node-locality, env-gating)
- Hub outage was what let the drain run.

### reference-a-landed-sha-is-not-the-requested-change-2026-08-10
- Repair B landed FAVORABLE c9faf50d in the WRONG function (verifyRegistryInventoryReach not verifyCountFilesReach), polarity inverted, displaced a broader abstention -> live regression introduced by operator-dispatched repair; revert recommended not performed. (directed-overshoot, hollow-landing, false-verification)
- Corrected re-dispatch of an edit goal is a no-op: same goal_hash, gap summary retained trial 1 text; correction never reaches drafter. (narrowing-duplicates, gap-content)
- Judge graded FORM not truth (10 vs 9 dirs); none of 16 verify*Reach oracles counts directories. (false-verification)
- concept-db search: bare `@@` vs search::score(0) mismatch; 41s from SELECT * of 384-dim vectors + ORDER BY — not dispatched (masked vessel). (trace-store-db, memory-recall)
- Serial dispatch only: concurrency starves inference to [].

### reference-a-libp2p-row-rewritten-into-an-http-address-hangs-forever-2026-08-10
- RELAY_MULTIADDR empty -> transport derives relay from /bootstrap ONCE at module load; substrate-live anchored to pre-migration droplet 138.197.116.56: 7,333 egress failures, 0 successes. Fix = restart transport; durable fix (read relay at use time) not made — code comment claims the invariant, implementation does opposite. (federation-p2p, docs-drift)
- reachableFrom rewrote libp2p rows into HTTP addresses (syzygy.host:18401 no route) -> fixed ada62cff (p2p first via 127.0.0.1:8401). Error path unreachable (12s x candidates > server idle timeout) -> 4s budget + idleTimeout 30s. Transport returns dead circuit as content.error with HTTP 200. `??` doesn't replace empty string in env. (endpoint-routing, env-gating)

### reference-a-lifetime-cpu-average-is-not-a-live-burn-2026-08-12
- surreal 107% lifetime average vs 3.6% 30s delta; use deltas and PSI avg10. (method)

### reference-a-load-induced-timeout-is-charged-to-the-drafter-2026-09-06
- feature-compose re-runs suite and keeps failures in both runs — load-induced timeouts reproduce -> charged to draft. Over 3,005 compose reports: timeout-containing verify FAVORABLE 16.3% vs 39.4% (OR 3.34); ~100 approvals lost (~10% of all FAVORABLE). Verdicts: 1056 FAVORABLE / 1410 applied-then-rejected-at-verify (47%) / 496 apply-failed. (spend-envelope-throughput, calibration-seal, false-verification)
- bumpFailedAttempts does four things: fa++ (-0.1 rank each), updateCalibration false negative into category seal, spends bounded human exemption, writes wrong-cause decision_outcome. Fix = label: classifyEnvironmentFailure inspects cutovers only; extend to verify (`env_test_timeout`). Identical defect repaired one stage earlier for cutovers, never extended. (calibration-seal, write-read-mismatch)
- Anti-compounding: load peaks when lane busiest -> noise correlated with work.

## Per-note extraction (batch 5: files 191-200)

### reference-a-long-scan-blocks-the-event-loop-...-2026-09-14
- substrate-gap.ts ~1048 `Bun.spawnSync(["systemctl","start","gap-compose.service"])` without --no-block froze dev-vessel for a whole compose on every gap write (silences 45-155s -> watchdog restart -> compose dies -> mints child gap -> another write). Same file had correct `--no-block` form 30 lines below. Fixed operator ca53600 (gap write 200 in 0.2s, 14/14 health 200). Gap store 7,323 -> 7,650 rows in one night; 36 picks/hour ZERO cutovers. (spend-envelope-throughput, narrowing-duplicates)
- FIVE wrong explanations (haiku drafting, LLM outage — "retracted this same claim once before, repeated it anyway", startup, long scan, CPU-delta watchdog guard implemented then reverted). Restarts had two drivers: self-recovery AND pull-sync on every origin/dev commit (own landings caused restarts). Duplicated error handler logs twice. (sync-deploy-drift)
- docker cp into /workspace/git/vessels is erased by pull-sync reset --hard.

### reference-alpha-beta-exceeds-total-executions-is-designed-chain-credit-2026-08-24
- ~98/771 arms alpha+beta-2 > 1.5x total_executions — by design (writeAncestorDelta, depth<=4, TD(lambda) gamma=0.5, fan_out_width division). successful_executions/success_rate LEGACY counters. Nearly filed as defect. (selection-learning; mechanism: chain credit, live-used)
- "A name is not provenance"; cross-session diff vs remembered number isn't a live rate.

### reference-a-masked-but-running-unit-is-a-latent-unrecoverable-outage-2026-08-15
- dev-vessel (/etc override shadowing /lib unit; dead 13 days; every edit-intent goal failed), concept-db (masked, running unmanaged on 34-hour-old code; autonomous fixes landed in a tree that never boots), surrealdb (masked after OOM, unmanaged 3 days, then full DB outage). Masking defeats Restart=, self-recovery, pull-sync, watchdogs. Detector (running unit not masked) "does not exist, cheap". (sync-deploy-drift, dormant-mechanism)

### reference-an-approved-cutover-is-discarded-by-a-concurrent-compose-2026-09-06
- db-admin-repair.ts: semantic PASS + cutover FAVORABLE, then a concurrent compose refreshed mirror -> live-sync rollback, nothing pushed; twice in 20 min; lane admitted 2 in flight vs cap 1. Hand-landed 8e0c579. No reconciliation of FAVORABLE verdicts vs pushed shas (law-6 detector proposed). Anchor-provenance gate reads SQL string literals as undefined symbols. (spend-envelope-throughput, false-verification, sync-deploy-drift)

### reference-an-empty-env-var-defeats-nullish-coalescing-2026-08-29
- vessel-exercise-scan.ts:3 `env ?? default` with DISCOVERY_ENDPOINT="" -> hostless fetch -> mock miss-path `{vessels:[]}` 200 = "healthy empty fleet". Fixed tests 6dd0cd3; resolver left, gap filed empty-string-env-vars-defeat-nullish-coalescing-endpoint-defaults (detector: flag `??` with string-literal URL default). (env-gating, endpoint-routing, test-residue)

### reference-an-escalation-that-only-logs-is-not-an-escalation-2026-09-11
- self-recovery-tick restarted federation-transport-vessel 19,348 times (1071 ESCALATE lines, 09-07 -> 09-11) with byte-identical error naming empty HUB_DISCOVERY_URL/RELAY_MULTIADDR. ESCALATE terminates in a log line. ~7.5 CPU-hours. Proposed consecutive-identical-outcome predicate. Retracted claim it caused CAPACITY refusals (read host loadavg). Filed an-escalation-that-only-logs-is-not-an-escalation. Green twin: recovered_by_restart counter masking a permanent fault. (dormant-mechanism, env-gating, federation-p2p, human-surface-escalation)

### reference-an-org-filter-on-a-knn-query-defeats-the-hnsw-index-2026-08-30
- concept-db dense leg dead >=5 days (~15-20k misses/day): org_id filter inline with KNN = 400x slowdown (48s vs 112ms) vs 2000ms budget -> silently lexical-only. Fixed two-stage query concept-db adfe470 (~840ms); consultPrinciples 74ms, composeLessonsBlock 257ms — drafter grounding read channel OPEN again. Code contradicted its own comment (concept.ts:679). Mid-session "scalar filters still fail" was load artifact at loadavg ~50 — refused to publish. 64k unprunable concept rows. (memory-recall, trace-store-db; WORKED)
- EMBEDDING default path /app/models doesn't exist in container (latent).

### reference-an-unparseable-autonomous-commit-reached-origin-dev-...-2026-09-19
- 84cd2f2 (Substrate Autonomous, 09-19) inserted array element above its declaration in boredom-vessel/src/index.ts; passed every gate, pushed; 1404 restarts/4h, ZERO gaps. self-operational-health.ts watches 14 timers and 0 services. Repair via operator goal -> 36954f2 (goal lane, no hands). Boredom down = cannot select its own repair (circularity). Filed landed-commit-was-never-parse-checked..., operational-health-detector-watches-zero-vessel-service-units. (autonomous-regression, hollow-landing, dormant-mechanism)
- boredom index.ts has 4372 lines containing NUL (rg blind); git blame authoritative over git log --.

### reference-an-unpushed-substrate-commit-of-runtime-state-wedged-the-deploy-channel-2026-08-10
- Local super-repo commit ff10d3a0 (Substrate Bot, 202 files runtime state: scenarios, harness output, interactor-log) -> clone diverged, ahead 1 behind 45 -> pull-sync refused loud, fleet frozen 45 commits stale; nothing consumed the refusal. Preserved as branch wedged-ff10d3a0, reset. (sync-deploy-drift, codebase-bloat-fossils)

### reference-an-unreadable-experiment-and-a-corrected-llm-blocker-2026-09-11
- -0.15 recommit down-weight 9b305d2: pre/post confounded by provider storm (exhausted 984 -> 5148) and operator directed goals -> unreadable; penalty stays. (narrowing-duplicates, selection-learning)
- LLM blocker CORRECTED: credentials not stuck cooldown — anthropic invalid key, openrouter overdrawn $0.20, chutes $0.0; GROQ/MISTRAL keys EMPTY (free keys never given; `if (!key) continue`); keys read at module load. Machinery correct. (spend-envelope-throughput, env-gating)
- 401 jump was 486 internal DiscoveryRegistrationLoop retries in 75s. Bucket by line body.
- Predicate law: unbounded existence predicate over append-only ledger is immortal -> class2 falsifiers must be time-bounded. (false-verification)
- posterior skip is a disjunction (all_deterministic OR idle); tier from TRACE not template; fixed learning-loop-selftest-tick a7667a33. Table trap: activity_template 0 rows, templates live in `activity`. Reach over POST 9/181=5.0%, edit 3/125=2.4%. (selection-learning, trace-store-db)

## Per-note extraction (batch 6: files 201-210)

### reference-a-one-shot-install-plus-restart-always-is-a-permanent-crashloop-2026-08-19
- substrate-ui-local federation-transport-vessel NRestarts=1681/5 days (`Cannot find module`) while is-active looked fine (Restart=always parks in activating/auto-restart). Unit workdir in super-repo clone without After=git-push-setup; vessel-ctl install guard `|| true` returned ok:true over a no-op; restart re-runs ExecStart never the install. Fixed 79cfbe9a (render-unit After=/Wants=, vessel-ctl deps reporting) — but render-unit.sh / vessel-ctl.sh were NOT in pull-sync's self-update set (would be inert in every running container) -> added. (sync-deploy-drift, federation-p2p)

### reference-a-oneshot-that-finishes-before-its-work-serializes-nothing-2026-08-09
- Spoke compose storm: load 46, 1850% CPU, 13 compose workspaces. Original mechanism (oneshot exits before work) RETRACTED — read unit via `head`; watchdog.conf drop-in wins (watchdog-tick.ts). Actual: feature-compose GapDrainObserver drain path had no concurrency cap; cap existed on nudge path only; `__drainInflight.size >= 2` bounds one plane only. Containment CPUQuota=500% --runtime on local-tools-vessel. Gap gap-compose-oneshot-finishes-before-its-work... filed (with the retracted mechanism in its id). (spend-envelope-throughput)
- Cgroup names executor not spawner. Never read systemd unit through head.

### reference-a-pathless-goal-is-captured-by-early-edit-intent-...-2026-09-19
- Dispatch d12205d6 ("Add TypeSafe's Jev as decision provider"): target inference fs_edit @0.98; EARLY EDIT-INTENT named activity-api/src/routes/template-audit.ts (not in goal) -> compose attempted edit on innocent file (survived via old_string not found). Filed pathless-goal-captured-by-early-edit-intent-onto-confabulated-file; fix = require path named in goal text. Lexical detector trips on "do not edit any file". (goal-walk-floor, drafter-quality, gap-content)
- PROVEN-BAD arms still selected: fs_edit alpha 1.9/beta 143.8 (158 exec), code_modification_proposal 36.9/517.3 (706 exec) — "suppression HELD pending satisfier re-baseline"; beta WITHHELD as symmetric abstention -> arm can neither lose nor learn. (selection-learning)

### reference-a-populated-node-modules-with-one-hollow-file-dep-2026-08-19
- Every container from current image crash-loops federation-transport: `file:../../../repos/libp2p-federation-transport` dep resolves to empty dir because git-push-setup clones super-repo without submodules; bun reports success. Working repair existed only as a hand-edit ExecStartPre on one container; render-unit.sh never had it. Fixed by self-repairing ExecStartPre in render-unit.sh; propagation requires converge_fleet_defs + vessel-ctl install + restart (enable --now no-ops). Also fixed ui-only-up.sh set -e/PIPESTATUS, vessel-ctl docker inspect of stopped container, self-recovery-tick starting() excusing auto-restart. (sync-deploy-drift, federation-p2p, dormant-mechanism)

### reference-a-probe-that-cannot-bind-returns-the-previous-processs-answers-2026-08-10
- Relaunched probe died EADDRINUSE 4x; the first broken-env process kept answering -> nearly "fixed" a nonexistent regression. Print identity/config at startup; fresh ports; no pkill in containers. `??` vs empty string again. (method)

### reference-a-raw-nul-as-a-composite-key-separator-makes-my-own-new-sources-binary-2026-09-21
- Operator reproduced the known NUL-in-source defect (form-census.ts, form-decision.ts) — git marks Bin, rg -P '\x00' prints nothing; detect by byte count; write `\0` escape behind a named constant. (codebase-bloat-fossils)

### reference-arbitrary-complexity-battery-hollow-reach-and-wrong-premise-2026-07-25
- Battery: G1 (fetch + count tags) and G3 (read + locate + summarize) HOLLOW reached (target inference picks raw input shape as terminal; LLM reachReason confabulates derivation); G2/G6 honest non-reach (partial-coverage + tool-error guards work); G5 novel puzzle mis-inferred codeSearchResult — no ReAct floor. (goal-walk-floor, false-verification)
- G4/B4: substrate self-authored and landed 687f7715 — hollow-correct (log lines + shadowing const) on a FALSE premise (already fixed at index.ts:931). Left as cruft. Operator lesson: verify premise against git before dispatch; subagent file:line claims confabulate. (hollow-landing, gap-content, codebase-bloat-fossils)

### reference-arbitrary-complexity-demo-and-two-blockers-2026-07-25
- nova2/nova3 novel single-source composites reached at parity. Blocker 1: multi-source composition (cardinality lost in GoalTargetDecision dedup Set; augmentation regex lacks comparison verbs) — gap-multi-source-composition-not-composed. Blocker 2: feature_compose declines multipart edits; fell through to hollow fileContent read reach — gap-feature-compose-complexity-ceiling-declines-multipart-edit. goalSignature: goalHashOf(goal) landed 5b8812f; cutover restart interrupted an in-flight dispatch (68b711bf). (goal-walk-floor, drafter-quality, sync-deploy-drift)

### reference-arbitrary-work-verified-and-runaway-shell-drain-2026-07-24
- Arbitrary work 7/8 correct via satisfier shellResult (write-to-file battery). Chronic CPU drain = 5 runaway awk float-modulo infinite loops (~7.3h each) — satisfier sh() had no timeout; substrate self-authored 6fb9282 AbortSignal.timeout(30000) (not yet deployed then). Gap satisfier-shell-runaway-commands-accumulate. surreal ballooned to ~23GiB RSS; template-list-cache all-or-nothing TTL fallback not hand-landed. (spend-envelope-throughput, trace-store-db, goal-walk-floor)

### reference-arbitrary-work-verified-cwd-keystone-2026-07-24
- Satisfier shell CWD not grounded to repo root: relative path -> 0, absolute -> 39 (bfdd173 fixed only the universalToolFallback prompt, not the satisfier). Gaps: satisfier-shell-cwd-not-grounded-to-repo-root, write-arrangement-hollow-reach-shape-blind-producer (selected seam-extraction template by shape coverage for a write), satisfier-shellresult-content-not-persisted-unverifiable. Reach-gate accepts wrong counts; command-synthesis literalism ("pwd"). Workflow subagents confabulate. (goal-walk-floor, false-verification)

## Per-note extraction (batch 7: files 211-225)

### reference-arbwork-blocked-llm-billing-exhausted-2026-07-23
- 07-23 "LLM billing exhausted across every provider" -> RESOLVED 07-24: spoke resolves llm_completion via hub over relay (PEER_FANOUT_MODE=union). Stale MCP key post-rekey fixed b2a0a878 (two config paths; MCP caches key at start). Discovery HTTP auth header-inconsistent (`X-API-Key` vs `Authorization: ApiKey`). Residual: target inference mis-routes goals containing substrate-internal vocabulary ("activity selection" -> activity_search, "hub" -> execution_write, "shape graph" -> goalWalkState). (federation-p2p, goal-walk-floor, endpoint-routing)
- Possible shape-name mismatch llm_completion vs llmCompletion (unverified).

### reference-arbwork-floor-routing-and-react-loop (07-23)
- Floor 0/3 grounded. Roots: target inference had no notion of shellResult as universal executor; universalToolFallback returned tool_calls with no text -> only a 0-tool LLM-memory answer survived and was rubber-stamped. Fixes goal-host 43247db (Fix B routing rule + safety net; Fix C grounded ReAct loop with groundedOk gate), f44b27b (executed command surfaced to judge; count-vessels hollow-green closed), 6cba611 (a.5 investigation fallback routed through shared runGroundedToolLoop; ".rs=6" fabrication closed), da08516 (federated-envelope 500). Fix C / runGroundedToolLoop deployed but UNEXERCISED live (0 firings) — primary satisfier path reaches first. (goal-walk-floor: WORKED for floor; dormant-mechanism for ReAct loop)
- Systemic root: LLM answer not grounded in an executed tool gets graded reached. "Grounding-to-a-tool != grounding-to-truth."

### reference-arch-intent-audit-and-member-drop-live-2026-07-26
- Audit of 109 openspec changes (179 agents, 8.3M tok): 35 implemented / 5 superseded / 39 partial / 30 not. Frontier: degenerate self-dev loops, learning-rate mechanisms built-but-inert from small bugs, self-detectors never wired, operator-gated greenfield. Re-grounding: only 12/27 dispatch items survived (multi-file, confabulated wrong-file, already-implemented). (docs-drift, dormant-mechanism, codebase-bloat-fossils)
- Member-drop reproduced: cluster-posterior type::record fix 4e80043 fixed UPSERT + docstring, DROPPED the SELECT (identical old-string at 2 sites); green on typecheck + reach; patched 71c9b2a9. Full push: 2/12 landed clean; e854692 hollow-green (ribosome replay-observer, detail=full on judge url) flagged for revert. (hollow-landing, drafter-quality)
- Keystone fixes (operator direct edits): d84efc0 droppedSiblingSites warning in feature-compose; d12c654 patch_with_tools calls resolveVesselMitosisCutover directly (staged-not-landed). Proof re-drive 0/3 — next binding constraint LLM-plane latency (multi-call pipelines over hub relay exceed 240s x2). Gaps: gap-feature-compose-drops-unrelated-set-members, gap-patch-with-tools-stages-mitosis-but-never-lands, gap-llm-arms-not-provider-partitioned. (spend-envelope-throughput, federation-p2p)
- Plane correction: "credit exhausted -> blocked" wrong again; hub funded. Phantom arms (codestral with empty key -> anthropic).

### reference-architecture-alignment-audit-2026-07-25
- Law 1: decision boundaries frozen as constants (SUBSTRATE_AUTO_DRAFT_THRESHOLD=0.3, EXPLORE_FLOOR=0.1, learning-track-classifier 1.0/0.5, BOREDOM_DISPATCHER_EXPLORATION_RATE=0.15 `Math.random()<RATE` — law 1 + law 5). (env-gating)
- Law 4 violated in practice: 3726 activity rows, 385 learned-* (~10%), 1956 declared gap-closing, extracted_from EMPTY on every row, ~11% ever selected, walk_tier NULL 96%, satisfier dominates learned_pathway ~4:1 (satisfiers short-circuit learned compositions). (composition-crystallization, codebase-bloat-fossils)
- Law 7 drift: goal-host index.ts:7615 writes auto_draft_decision gaps opened-and-closed <60s (bookkeeping close gaming); real self-repair closures ~0; 683 open/170 stale; self-alteration authored->landed ~8%. (false-verification, gap-content)
- Law 8: reach-gate never unwrapped shellResult envelope ({stdout:"",exit_code:0} greened). Law 11: hardcoded fallback endpoints (author-producer.ts:281, activity-create-variant.ts:639 + 5). Law 12: error-envelope check misses ok:false web_resource envelope. Law 10 aligned. (endpoint-routing, false-verification)
- META: every mechanism exists; drift is load-bearing behavior frozen as constant, or gate checks SHAPE/STATUS not CONTENT.

### reference-architecture-docs-framing-validity-2026-07-24
- Architecture docs valid as intent not realized dynamics: SF blend default-off (SF_BLEND 0); spectral-gap metrics-only/never gated; lambda2 gate deadlocked always-closed (compose-teacher works around); TTSA not implemented (choice.ts hardcoded Thompson). Dictionary break on credit discounting (gamma-discounted vs gamma=1 vs code TD_LAMBDA=0.7 trunc@4); 4-vs-7 family membership; FOUNDATION imports frontier conjecture as law; FLEET identity formulas asserted but code differs. (docs-drift, dormant-mechanism)

### reference-architecture-intent-drafting-precision-...-2026-08-26
- Ruling: drafting-precision is SYSTEM's job. Test: "Could a trace, the tree, or a doc the system already reads have contained this fact?" Yes -> system gap; No -> operator authors once at class grain. (a) feature-compose.ts:2367 writes canned class-grain compose_lesson text; rich critique stays gap-grain -> corpus 4 lessons vs 23 rejections/24h. (b) concept usage grading keyed to shape-resolution co-occurrence, not injected-concept -> draft verdict. (memory-recall, selection-learning, write-read-mismatch)

### reference-a-real-6x-reach-collapse-...-2026-09-13
- Compose FAVORABLE 15-24%/day baseline -> 0-6% sustained 25h from 09-12 ~18:00. Four causes refuted (arm/per-task prior, failover rate, 6417ff6 cosmetic guard, prompt bloat 62da19f). TS1002/TS1127 truncation signature. Selector inversion REAL but RETRACTED as the cause: claude-sonnet-5/haiku/nemotron-nano at prior 1/1 win the draw, anthropic 401 sets no cooldown, failover recorded ungraded -> can't accumulate beta; measured arms 1.3-4.5%. 18:00 step remains UNATTRIBUTED. model-policy.ts:113 1/1 cliff (hierarchical prior fix proposed). llmQuotaState reports key-presence not reachability. Stale policy file rev10 vs live rev11 story (2nd time). Four instrument artifacts (window inside regression, own probe dating logs, renamed probe, `graded ` vs `graded=`). (selection-learning, spend-envelope-throughput, drafter-quality)

### reference-a-re-cutover-of-the-same-proposal-silently-reverts-the-fix-it-just-landed-2026-09-14
- fc7789c then 734393a (same proposal route-edit-92ad1532) — second applied inverse of load-bearing line; orphan `blameEmitted` (noUnusedLocals off). Drift check "clone clean at its own HEAD" covers uncommitted, not committed regression; needed `staged_base_sha == HEAD`. 17/406 proposals (4.2%) cut over more than once (worst 5x). Compose reports overwritten in place cannot witness history. Operator mis-credited improvement to fc7789c (was 855b3f8). Manufactures recommit churn from successful composes with fully green trail. (autonomous-regression, narrowing-duplicates, sync-deploy-drift)

### reference-a-restart-loop-reports-activating-never-failed-2026-08-20
- Fresh fleet: every LLM arm shipped twice on the same ports (static llm-resolver-{opus,haiku,google} vs rendered llm-*) -> EADDRINUSE loop NRestarts=95/40min; doctor "no failed units". Fixed entrypoint.sh retiring superseded static units. (codebase-bloat-fossils/duplicates, sync-deploy-drift)

### reference-arm-retirement-is-data-arm-addition-is-code-2026-08-20
- llmModelPolicy_write controls selection, not routability (hardcoded OPENAI_WIRE_PROVIDERS; VLLM_ENDPOINTS env). Retirement not restart-durable (ensureArmsForModels re-seeds every keyed model at Beta(1,1)). No CAS on policy write path (lost a success increment). Memory store DOWN (dev-vessel masked on hub) -> cache-only note. (env-gating, selection-learning, memory-recall)

### reference-arrangement-frontier-and-discovery-query-gap-2026-07-24
- Arrangements fail: shell env law-8 starvation (no python/node/bc, CWD /workspace not repo root, prompt never told); hollow reach stamped with reason saying answer ABSENT; dev-vessel discover() returned [] on 401 -> feature_compose tools=false. Root: stale METABOB_API_KEY in /workspace/.substrate-secrets shadowing /etc/substrate/env (later EnvironmentFile wins). Fixed by aligning key; self-dev restored: bfdd173 (env facts in fallback prompt), 5ca4f0b, 691142d (negation-marker self-consistency guard) all substrate-authored. Fix #1 patched only fallback prompt, primary executorGuidance@2184 lacked env facts -> fix 1c dispatched 541c21e4. Class fix proposed (volume secrets must not diverge; federation_join_health gap). (env-gating, endpoint-routing, memory-recall two-stores analog, goal-walk-floor)

### reference-a-self-retracted-refutation-still-counts-toward-the-quorum-2026-08-28
- refute() accepts refuted===true && conf>=0.8 && reason.length>=20; refuter retracted in its own reason, counted at 1.00 -> correct change rolled back. Widened quorum left the meaningless length guard. Filed a-self-retracted-refutation-still-counts-toward-the-adversarial-quorum. Gate also caught operator manufacturing a close. (false-verification)
- substrateGap_write REPLACES classification_metadata (destroyed measured_by/resolver/reading; approach_decisions law-12 record at risk). fc-coverage warns TARGET HAS NO TEST FILE (d96e2ae unconditional self-call hung the vessel). Drafter locates but cannot invent — transcribe literal code.
- Narrowing livelock reproduced live by operator retries: -narrowed child verbatim, fa=0, outranks parent; runner-up is itself. (narrowing-duplicates)

### reference-a-substrate-authored-deletion-wedged-the-surql-landing-gate-2026-09-22
- v_shape_pattern_performance (023, zero readers) over empty execution poisons inserts (array::group) and survives REMOVE TABLE; `DEFINE TABLE IF NOT EXISTS` makes warm/cold stores diverge. (trace-store-db, codebase-bloat-fossils)
- Substrate commit 54b7762 deleted 39 lines of surqlBreakingFieldRefusal guard -> gate refused every non-DEFINE-FIELD statement; all .surql landings wedged since 09-16, zero gaps. Restored 1a18944 by substrate. (autonomous-regression, dormant-mechanism)
- ~22 activity-api sql files HTTP-400 wholesale on cold boot (both 021 variants => v_activity_score exists on NO deployment) + 057/076/077 NULL org seeds. Fixes 50946be, 291b72d, 41c9e89 (pwt refuters confabulated `array::len([])` throws). 045 array::len(NONE) killed auth-telemetry. 12 stranded unpushed autonomous commits wedged super-repo pull-sync 16h (branch stranded-autonomous-2026-09-22). Audit rerun 19b3e668: 26/26 MET. (sync-deploy-drift, trace-store-db)
- Human surface ran from a third tree /workspace/git/human-surface-release.

### reference-a-suite-failure-count-is-only-comparable-under-fixed-bun-path-and-load-2026-08-29
- Same commit f289e51: 43/35/30 failures by bun version (host 1.3.9 vs container 1.3.14), checkout path, and load (21/36 timeouts at 5000ms calling live services). Stable code-attributable ~15. (test-residue-live-state)

### reference-a-symptom-only-goal-cannot-structurally-reach-the-authoring-capability-2026-08-11 (RETRACTED)
- Claim "target file is a regex over goal text, no inference" RETRACTED — goal-file-resolution.ts (927 lines) exists at index.ts:12099; real defects were a two-word vocabulary hole (799ccb3) and vessel-scoping. "Absent from where I looked is not absent." Kept as error shape. Proposed bridge (code_search on distinctive terms, grade separately). (goal-walk-floor, gap-content)

---

# SYNTHESIS BY PROBLEM CLASS (recurrences aligned)

## write-read-mismatch (DOMINANT recurring class in this shard)
Same shape, many hats: a producer writes to a place/field/scope/id-form the consumer never reads, and every status reads green.
- 07-20 credit fan-out: 6 credit paths from one reached execution, 4 broken (unicode alias ids vs bare-id read; RBAC silent drop; NULL-confidence CREATE failure; labels write-only; posterior read w/o GROUP ALL). "THREE disagreeing alphas". Fixes d9e48cf/1787879/c9dd7b6; label->posterior fold still empty (fc297b4).
- 07-14 execution dual-write silently dropped via JWT $token vs $auth PERMISSIONS (27dca9b).
- 07-15 fs_edit snake_case vs camelCase keys (d5562108); llm envelope vs .text (1e2087a); resolveImpulseSlot parse (1a626c8); upstream LLM prose-prefixed JSON hoist (ef54c05).
- 07-16 walk Thompson with NO posteriors: legacy transform dropped metrics; phantom `activity_metrics` table; view empty != error (a4ff8b2, e2b40c9, 1e2e628).
- 08-03 template list endpoint embedded stale alpha/beta; /metrics route 100% parse error (f5eb515, 41e7e59).
- 08-29 gap store normalizes gap_id (point read-back by supplied id always misses); fail-soft keeps shape drops fields (learning-mode.ts); rename 22c6660 migrated readers not declarations; two registries blind to shared omission (cyclic_flow_scan).
- 09-06 effectiveTags mutated after handoff (13,000:1 loss) fixed 6273bf6; /run-goal snake_case learning_mode; activity-table posteriors vestigial (09-08) — six belief families.
- 09-10 execution_exemplar 0 rows ever despite worker "processed:101 failed:0".
- 09-11 appendComposeLesson two writers; read path stores install preamble (107a75c7).
- 09-15 hollow_write: new fields with zero readers (0576dbc, 617ed21, d8a5f84); concept-db X-Api-Key vs Authorization scopes.
- 09-22 escalations written to pinned :8270, human surface :8310 never reads; category rewrites hide gaps from the surface filtered by category.
Root: no contract that a write has a reader; verification done with the writer's own credentials/ids/stores. Proposed class detector (09-10): "store with a designated writer empty while its input is non-empty".

## false-verification
- Judge graded literal placeholders, prose FORM, confabulated derivations (07-20, 07-25 G1/G3, 08-10 G9); fallback flipped hollow verdict with zero trace; fast-path oracle false reach alpha+2 (08-17, 58376c1); verifier missing scope dimension credited 72 vs 60.
- Gap closures: 69% TTL expiry / 1.9% repair (08-28); remedy asserted that never happened (09-06); failed walk's closing write survives reached=false and erases evidence (09-05); bookkeeping open-and-close <60s (07-25 index.ts:7615); unbounded append-only falsifier immortal (09-11).
- Refuter quorum counts self-retracted refutation (08-28); gate verdict nothing reads (feature-compose.ts:2068); rungs/metrics windowing test ("can it flatter you today").
- Execution-level reach 48% = 92% self-scan ticks; honest goal-level 5.0% / edit 2.4% (09-11).
- new_git_sha graded as landing though unpushed (09-14; 5/1206).
Root: gates read shape/status/presence rather than content/effect; verdicts not reconciled against receivers.

## hollow-landing
- 687f7715 (07-25) cosmetic log + shadow const on false premise; e854692 (07-26) hollow-green; 4e80043 member-drop; endpoint-swap loop 7ea7d52 fake URL, f79fadb unguarded index (08-03); c9faf50d wrong function (08-10); 0576dbc/617ed21/d8a5f84/c532795 inert (09-15, 4/7 inspected); fec22cbc half-landed after refusal (09-12); 84cd2f2 unparseable pushed (09-19).
- Hollow write seals the gap (consumes the one landing -> pending forever).

## autonomous-regression
- f365f3a (07-04) reversed "no-work is not a win" credit contract; eb42e0b deleted execution citation (fixed c173011); 01e3dd9 deleted requeueAfterNonAttempt (reverting 86cdbf2); 54b7762 deleted surql gate guard (09-16 -> 09-22); 84cd2f2 unparseable boredom commit (1404 restarts); 734393a re-cutover reverted fc7789c; 08-11 drafter prepended hallucinated Express file into LIVE goal-paths.ts (activity-api crash loop twice); 08-09 rolled-back compose truncated discovery-vessel live src to 2.4KB; 08-28 stale-base patch silently reverted verified fix 3 min post-push.
Root: landings record WHAT not WHY (866 commits same template); gates read diffs not behavior; drafting against live tree; no staged_base_sha==HEAD check.

## directed-overshoot
- dd1195b (08-11) exclusion turned ambiguous->unique, misroute; reverted 88b212a. c9faf50d (08-10) operator-dispatched repair displaced broader abstention -> live regression (revert recommended not performed). 95d973e6 regression (reverted b865620b, 09-11). Operator retries manufacture narrowing livelock (08-28). Operator false oracle nearly shipped (08-29). Resolve-URL joiner overshoot (MEMORY index, 09-22).

## sync-deploy-drift
- mirror-to-live excluded sql/ (07-14, 11ec70dc); stranded mitosis-pending.json jam; hub deploy opaque; activity-api cutovers no-op (07-16); dist-shipped library not rebuilt (07-15, fixed by substrate:deploy hook 0dcf370/58c5638); dev-vessel cannot self-deploy own resolvers; render-unit.sh/vessel-ctl.sh not in pull-sync self-update set (08-19); unpushed runtime-state commit wedged deploy 45 commits (08-10, ff10d3a0); 12 stranded autonomous commits wedged 16h (09-22); masked-but-running units (08-15: dev-vessel dead 13 days, concept-db frozen, surrealdb outage); pull-sync SIGKILL at 15 min and timer never re-arms (08-08); pull-sync restarts on every push make gap writes HTTP:000 (08-29) and kill composes (09-14); drain markers written only at apply (08-10); worktree `.git` file (09-11, 29756da); pull-sync destroyed unpushed a340697 (09-14); human surface running from third tree.
Root: three trees (runtime /vessels, clone /workspace/git/vessels, host repos) with multiple ad-hoc sync paths; "a commit is authored" != "in effect"; process_start > file_mtime is the only deploy test.

## spend-envelope-throughput
- 82.5% of picks refused at capacity after paying for selection (289cf2f); compose storm without drain-path cap (08-09); runaway awk (07-24, 6fb9282); spawnSync freeze per gap write (ca53600); concurrent composes on one path discard approved cutovers (09-06); load-induced timeouts charged to drafter (~10% of all FAVORABLE lost); LLM credentials (anthropic invalid, openrouter overdrawn $0.20, chutes $0) and empty GROQ/MISTRAL keys; multi-call pipelines over hub relay exceed 240s x2 (07-26); compose FAVORABLE 1.6%/attempt (09-01), 15-24%/day baseline then 0-6% (09-12).

## calibration-seal
- hopeless() at 8+ attempts seals; escape valve asked 1755x/48h unanswerable (08-28, 421052c) then 248 escalations to unread vessel (09-22); gaps filed into sealed category escalated immediately; bumpFailedAttempts feeds updateCalibration with load-timeout false negatives (09-06); docs-align false positives would feed sealed documentation_drift (08-28).

## narrowing-duplicates
- -narrowed children verbatim with fa=0 outrank parents (08-28 live); false-premise families respawn children (09-11); per-gap backoff moved waste to recommit lineage -> lineage-grain b44dcad (09-01); 391 open recommit gaps (09-14); re-cutover churn; corrected re-dispatch same goal_hash no-op (08-10); gap store 7,323 -> 7,650 rows in one night (09-14); -0.15 recommit down-weight unreadable (09-11).

## gap-content
- Truncation at gap-to-feature.ts:2670 minted nonexistent edit_site (13f7d07); phantom demand (already-fixed org_id) drove 2 outages (08-11); false-premise gaps 17/600 (09-11, detector excludes not closes); pathless goal -> confabulated file (09-19); comment-phrase localization (08-11); operator vs autonomous one-op edits 3/3 vs 4/26; "the drafter obeyed a clear instruction correctly; the instruction was wrong".

## drafter-quality
- Drafting plane ~100% failing (07-20); success-blindness loops; multi-hunk fails / single-hunk lands; member-drop on duplicate anchors; mangle rate scales with size; locates but cannot invent; endpoint confabulation (fixed forward by contract injection 9848850); load-induced false charges; all reachable arms 1.3-4.5% (09-13).

## selection-learning
- Posteriors disconnected from walk (07-16); pinned-dispatch id aliasing; never-reaching composition at ev 0.67 (credit keyed to clean exit, 09-06); PROVEN-BAD arms held selectable with beta withheld (09-19); 1/1 cold-start inversion after honest grading (09-13); chain credit by design (08-24); posterior skip disjunction (09-11); no learning curve on saturated families (08-08); reuse compounds z=+20.9 and convergence 2.3x (08-08); first reach never acquired for 72% of classes.

## composition-crystallization
- Ribosome WS path fired zero times (07-20); applyExtraction never passed (fixed 5f96ba4, 08-03, WORKED: learned-* minted, 16/19 used); variant_promote not implemented; extracted_from empty everywhere, satisfiers short-circuit learned pathways 4:1 (07-25); composed seam-extraction capability minted from prose and walked 5/5 (07-15); adaptation first observed 09-06; donor stores differ; fs_edit/code_modification_proposal zero donors by construction.

## goal-walk-floor
- ReAct floor built (43247db/f44b27b/6cba611) but Fix C loop unexercised; CWD not grounded; shell env facts missing from primary prompt; internal-vocabulary mis-inference; multi-source cardinality lost; derivation-over-source hollow greens; fs_largest 1/13; honest reach low (5%).

## memory-recall
- Concepts stored != consultable (07-20); dense concept leg dead 5 days from org filter (fixed adfe470, 08-30); lessons written into unread auth scope; compose-lesson JSONL stored preamble; canned class-grain lessons (08-26); memory store down on hub -> cache-only notes (08-20); recall AND-matched lexical (08-08).

## dormant-mechanism
- self-recovery.timer inert (08-11); ESCALATE terminates in a log line (19,348 restarts); operational-health watches 0 services; gap-compose unit masked with exit code discarded (08-09); spectral gap / SF blend / TTSA dormant; execution_exemplar never scheduled; parity-gate tools never minted as activities; census rhythm never fired unassisted; posterior-core CRDT held; deterministic:verified-* oracles 0 firings; env_gate_fulfilled calls a route that exists nowhere.

## env-gating
- EXEMPLAR_SELECTOR_RUN_ON_BOOT; DUAL_WRITE_ENABLED in /etc/substrate/env; replication cadence setInterval + env; decision thresholds as constants; RELAY_MULTIADDR read once at module load; keys read at module load; `??` defeated by empty env; volume secrets shadowing env file; GOAL_HOST_VESSEL_REPO default; routable model set hardcoded (VLLM_ENDPOINTS env).

## endpoint-routing
- Pinned :8270 escalation; libp2p row rewritten as HTTP (ada62cff); discovery vesselCapability vs executing /resolve; envelope drift per vessel; hardcoded fallback endpoints (7 sites); MCP concept tools 404; discover() [] on 401.

## federation-p2p / node-locality
- Relay anchored to pre-migration droplet (7,333 failures); hub funded while spoke reported "all dead" (3+ times); hub arm policy write not applied; cross-node controls (hub 9 vs spoke 6); GapDrainObserver listened on HUB websocket; out-of-role local activity-api; replication pull via egress built 07-14.

## trace-store-db
- SurrealDB traps: composite index strict-subset -> 0 rows; equality dropped beside dedicated datetime index; GROUP ALL returns unfiltered count; string vs datetime compare; NONE != NONE; VALUE default not firing on INSERT; KNN + scalar filter defeats HNSW; poisoned computed views on empty tables survive REMOVE; DEFINE IF NOT EXISTS warm/cold divergence; ~22 migration files fail cold boot; FTS index build 94s cannot pass startup gate.

## test-residue-live-state
- Tests calling live services (21/36 timeouts), module-scope fetch mocks polluting, failing tests as polluters, layout-dependent tests, probing live learning surfaces, pull-sync erasing docker cp.

## docs-drift
- variant_promote documented not implemented; architecture docs overstate realized dynamics; credit-discount dictionary break; code comments contradicting code (concept-usage-record header, hopeless(), concept.ts:679, compose-lessons "only ONE class" comment); relay "reads at use time" comment vs module-load implementation; substrate cannot repair comments (comment-only refused).

## codebase-bloat-fossils
- 88% of templates zero executions, 1311 degenerate; fossil files 12k/6.9k/5.7k lines (partly decomposed); vestigial activity-table posteriors, phantom activity_metrics, unused goal_execution_paths.success, activity_template 0 rows; zero-reader views (023); duplicate LLM arm units; debug cruft [rIS-debug]; NUL bytes in sources; dead AET shadow residue; runtime state committed to super-repo.

## human-surface-escalation
- 248 escalations 0 answered; uiQuestion exit returns 500; gaps vanish from ui_legibility board when touched; humans-as-resolvers gap trail (07-13) unbuilt.

# MECHANISMS (keep / fossil assessment)
See structured record; highlights:
- KEEP (general, live-used): mitosis cutover + semantic gate + adversarial refuters (correct most of the time, needs retracted-refutation + staged_base_sha fixes); substrate:deploy hook for library vessels; chain credit (writeAncestorDelta); lineage-grain backoff; false-premise admission exclusion; goal-file-resolution; grounded ReAct loop (runGroundedToolLoop); compose-lesson corpus in concept-db (drafter read channel now working); execution table as sole trace store + replication pull; parity gate (deterministic).
- FOSSIL/DORMANT: AET shadow; activity-table posterior columns; activity_metrics phantom; v_shape_pattern_performance (023); spectral gap / SF blend / TTSA; posterior CRDT design; operator seam-extract.ts/parity-check.ts in job tmp (never minted); variant_promote (doc-only); census/validation rhythm families (never fired unassisted); deterministic:verified-* oracles; env_gate_fulfilled shape; stateful-ui-vessel :8270 as escalation sink.

# PRINCIPLES / LAWS stated in this shard
(see structured record list)

1. A self-reverting loop is not self-correcting; read the whole commit sequence (reference-10h-audit, 08-03).
2. A landed sha is not the requested change; `reached` on an edit goal tests that a commit landed, not that the named function changed (08-10).
3. `new_git_sha` is not landing evidence; honest predicate is pushed / is-ancestor origin/dev; re-verify a landing after the next sync, by reading the live line (09-14).
4. A commit is evidence a change was authored; only the current file is evidence it is in effect (09-14).
5. Never accept an additive-only diff as a fix; cite the reader by file:line; ask whether the predicate can ever be true; measure the artifact too (09-15).
6. A gate that READS a diff cannot certify reach — parse/run it (09-19); a guard at the wrong stage cannot protect an earlier stage (08-11).
7. Adding a verifier to a class it cannot fully represent is worse than no verifier; where completeness is unreachable, abstain (08-17).
8. Prove the check can fail before trusting that it passed; every filtered aggregate gets an impossible-predicate control (08-17, 09-03).
9. A control must exercise the same path/writer as the value under test (09-06); a negative is unattributed until a positive control shares its address (09-22).
10. Read the receiver, never the worker's self-report ("processed:101 failed:0" vs 0 rows) (09-10).
11. For each store with a designated writer: is it empty while its input is non-empty? (law-6 detector, 09-10).
12. A truncation safe for prose is a correctness bug for a path (09-10).
13. A refusal naming the wrong site is usually a missing-evidence verdict; answer a refuter with a measurement (09-10).
14. A metric change that cannot flatter you today is a repair; one that does is gaming — run per-rung (09-10).
15. A failed walk's writes survive its verdict — the fix is transactional (defer or snapshot-restore) (09-05).
16. A close must be gated on evidence the behavior STOPPED (09-06).
17. An unbounded existence predicate over an append-only ledger is immortal — time-bound class2 falsifiers (09-11).
18. Nothing re-checks whether a gap is still TRUE before spending a compose on it (08-11); a false-premise gap looks like a drafter defect (09-11).
19. The drafter obeys instructions; if the instruction is wrong, the output is wrong — goal content is the bottleneck (09-11).
20. Inferring a target and then editing it converts an unroutable goal into damage; refusing to route is safer than routing to a guess (09-19).
21. An exclusion that can turn AMBIGUOUS into UNIQUE is dangerous; a stated risk is not a mitigated one (08-11).
22. Comments are the highest-risk corpus for prose localization (08-11).
23. The test suite is the substrate's only durable memory of its own contracts; landings record WHAT never WHY — make the landing template record WHY (08-29).
24. Before making a red test green, ask whether the demanded behavior was removed on purpose (git log -S); a substrate-authored reversal of a human contract is suspect by default (08-29).
25. Failing tests are polluters; fix instruments before triaging findings; a detector that cannot run hides the defects it was built for (08-29).
26. Verify a write by listing / reading as the consumer authenticates, never with the writer's own id/credential (08-29, 09-15).
27. A wrong gap left in the store is worse than an unfiled one — it is a standing instruction (08-29).
28. Fail-soft that keeps the shape but drops the fields is worse than failing (08-29).
29. A writer that pins a peer address cannot learn the peer was replaced — route by shape (09-22).
30. An escalation that only logs is not an escalation; K byte-identical outcomes => stop restarting, file the error verbatim (09-11).
31. A restart re-runs ExecStart, never the install; check NRestarts not ActiveState (08-19, 08-20).
32. A masked-but-running unit is a latent unrecoverable outage; masking disables the entire recovery stack (08-15).
33. A vessel healthy now can be dead on next boot (08-09).
34. A guard that fails loud still needs someone able to act on it (08-10).
35. A gate that holds the door but never opens it is the same outage with a longer preamble (08-10).
36. A cap in one plane does not bound another — enforce at the resource (08-09).
37. A control that repeats under a constant confounder is not a control (load-induced timeouts) (09-06).
38. Measure the effect per condition before naming a cause from the mechanism's own inputs; bracket a suspected step with a window that contains healthy data (09-13).
39. Wiring honest grading onto a selector with a 1/1 cold-start prior inverts the ranking; an auth failure must cool the arm (09-13).
40. A deterministic fast path is a shortcut past the walk's honesty gates (08-17).
41. Grounding-to-a-tool != grounding-to-truth (07-23).
42. Correctness can live entirely in a deterministic gate so the generator can be weak (parity gate, 07-15).
43. Decompose-below-ceiling + one hunk per goal lands where multi-hunk fails; transcribe literal code; state a post-condition (07-15, 08-28, 09-11).
44. Chasing a bug downstream before probing the upstream resolver output wastes N fixes (law 8, 07-15).
45. Attribute a dispatcher by log volume per unit; cgroup names executor not spawner (08-03, 08-09).
46. Verify a write by fetching the id, never by grepping a ranked list (08-03).
47. A family that saturates on first exposure cannot evidence learning (08-08).
48. Before trusting a rate, ask what its support region excludes (08-08); never quote reach without splitting by author and by goal vs tick (09-11).
49. A true-sounding law inferred from a misread instrument is still a fabrication; never read a systemd unit through head (08-09).
50. "Absent from where I looked" is not absent; when N trials fail identically, read the gate (08-11 retracted note).
51. Don't copy files into containers; code lands via the git remote the container pulls (07-20).
52. Skill learnability: decomposes onto resolver surface + trace-gradable + reaches once at floor (07-12).
53. Drafting precision is the system's job: "could a trace, the tree, or a doc the system already reads have contained this fact?" (08-26).
54. The learning signal must not terminate at write-only stores; a loop that cannot metabolize its training signal does not learn (07-20 critic thesis).
55. Architecture docs describe intent; mark dormant mechanisms as dormant (07-24).
56. When an artifact is overwritten in place it cannot witness its own history — use git (09-14).
57. An operator retrying a failing dispatch manufactures a narrowing livelock (08-28).
58. The substrate cannot repair its own documentation while comment-only changes are categorically refused (09-11).

# MECHANISM TABLE (full)

| name | location | purpose | general/specific | status | evidence |
|---|---|---|---|---|---|
| mitosis cutover (git-aware) | dev-vessel src/resolvers/vessel-mitosis-cutover.ts | stage->verify->commit->push substrate edits | general (shared seam for all self-edits) | live-used, defective | re-cutover reverts (734393a 09-14); stale-base patch revert (08-28); drift check reasons about uncommitted only; host_sync_pending 5/1206 |
| semantic gate + adversarial refuters | feature-compose.ts ~1383-1421 refute() | judge whether a diff addresses the gap | general | live-used, partly broken | counts self-retracted refutation at conf 1.00 (08-28); length>=20 guard; right in 3/4 (09-12); confabulated dialect facts (09-22) |
| fc-vacuous / dead-code / comment-only refusal | feature-compose semantic gate | refuse no-op diffs | general | live-used | refuses correct declaration-anchored edits (09-11, 09-14); substrate cannot repair comments/docs |
| drafter-corruption parse signature | vessel-mitosis-cutover.ts (bec9d8d) | reject unparseable staged files | specific | partial (wrong stage) | recurred 2.5h later pre-cutover (08-11); 84cd2f2 unparseable still pushed 09-19 |
| substrate:deploy hook | repos/ias-executor-ts/scripts/substrate-deploy.ts (0dcf370, 58c5638) | rebuild dist + fan out + restart consumers after library cutover | general for library vessels | live-used (07-15) | ledger interface-deploys.jsonl ok:true; restart-order race fixed |
| pull-sync content-hash mirror | scripts/substrate pull-sync (596fd717) | converge runtime to origin/dev | general | live-used | closed split-brain 07-20; but destroys unpushed commits, restarts vessels on every push, refuses on divergence with nobody consuming it |
| mirror-to-live incl sql/scripts | super-repo 11ec70dc | migrations reach runtime | general | live-used | 07-14 |
| chain credit writeAncestorDelta | activity-api src/lib/posterior-update.ts | fan reach credit to ancestor arms (depth<=4, gamma 0.5, fan_out_width) | general | live-used | 98/771 arms alpha+beta >> executions by design (08-24) |
| canonical posterior store variant_performance_metrics + context_thompson_scores | activity-api | Thompson belief | general | live-used | 4571 arms, 7879 rows (09-08) |
| activity.thompson_alpha/beta, activity_metrics, goal_execution_paths.success, activity_template | activity-api schema | legacy belief/fields | — | fossil (vestigial/phantom/empty) | all rows 1/1/0; activity_metrics empty; success None 9864 rows; activity_template 0 rows |
| execution table (sole trace store) + v_paradigm_execution_traces | activity-api 848e7e1..9d46962, migrations 157-160 | lossless trace store | general | live-used | AET decommissioned 07-14; DUAL_WRITE_ENABLED=false env-gated |
| AET activity_execution_traces | activity-api | old trace store | — | fossil | counters still increment, db-admin names it, E33 do-not-ship |
| execution replication pull | activity-api src/routes/replication-pull.ts + src/jobs/trace-replication-tick.ts (3a4c045..0e128ca) | pull-based anti-entropy between peers over libp2p egress | general | unknown (validated 07-14; law-1/5 violating setInterval/env; relay anchor failures 08-10) | bidirectional rows proven 07-14 |
| posterior CRDT vpm_partition design | design only (07-14) | lock-free cross-instance priors | general | dormant (held, never built) | — |
| lineage-grain backoff | dev-vessel gap-to-feature (b17eccd, b44dcad) | stop re-picking failing gap lineages | general | live-used | pick concentration 58%/12 gaps -> 9 picks/7 gaps (09-01) |
| capacity peek | dev-vessel (289cf2f) | check compose capacity before selection | specific | live-used | composes 5.8->10/hr |
| false-premise admission exclusion | gap-to-feature.ts admitActionableGaps (09-11) | exclude gaps whose quoted anchor is absent after >=2 failures | general | live-used, half (excludes not closes) | 17/600 gaps affected |
| phantom-typecheck (E2) exclusion | gap-to-feature.ts | exclude phantom typecheck gaps | specific | live-used | model for above |
| truncation guard + examination_unexamined_files | gap-to-feature.ts:2670 (13f7d07), trace field (172c7f7) | stop mid-token path cuts; name unexamined files | specific | live-used | recurrence stopped 09-10 |
| goal-file-resolution | goal-host src/goal-file-resolution.ts (927 lines, called index.ts:12099) | symptom -> file localization, fail-closed | general | live-used | vocabulary hole fixed 799ccb3; comment-phrase phantom matches (08-11) |
| early edit-intent detector | goal-host index.ts | route goals naming a file to feature_compose | general | live-used, defective | confabulated file for pathless goal (09-19); mis-routes read goals naming src (07-25) |
| grounded ReAct loop runGroundedToolLoop / universalToolFallback / a.5 investigation | goal-host (43247db, f44b27b, 6cba611) | ReAct floor with groundedOk gate + command evidence to judge | general | deployed, unexercised (dormant) | 0 firings post-deploy 07-23; primary satisfier path reaches first |
| satisfier shellResult + executorGuidance | goal-host + local-tools-vessel | universal executor | general | live-used | 156/194 probe dispatches (08-08); CWD/env-facts defects; 30s AbortSignal 6fb9282 |
| lexical rebind (reachedCommandCache) | goal-host tryLexicalRebind, /workspace/.goal-host-reached-commands.jsonl | first-mile adaptation by command replay | specific (command-shaped only) | live-used, rare | first selected=true 09-06; lying log line still live; 0.15 scaffold threshold |
| pathway reuse via goal_execution_paths shape_signature | goal-host + activity-api | ceiling / learned pathway reuse | general | live-used after backfill | 09-06 counterfactual; 07-20 consultation was dead |
| ribosome extraction (applyExtraction) | ribosome-vessel src/index.ts:153 (5f96ba4) | mint learned-* templates from reached executions | general | live-used since 08-03 | 13 learned-* by 03:5x; 16/19 used |
| variant_promote | documented in dev-vessel CLAUDE.md | promote variants | — | doc-only (not implemented) | 08-03 |
| composed seam-extraction capability | activity composed-cap-author-a-behavior-neutral-seam-extractio (author_composed_capability) | self-maintenance extract-module from existing resolvers | general | walked 5/5 once (07-15); handed to boredom rolling-pool; autonomous use unverified | dc00c441 |
| parity gate + seam-extract.ts / parity-check.ts | operator job tmp (07-15) | deterministic behavior-neutral split verification | general | fossil (never minted as activity; spec in openspec 2026-07-15-vessel-maintenance-parity-gate) | 3 cycles activities.ts, c3fe0b7, b5a37cc |
| boredom external goal pool | boredom-vessel sampleExternalGoal + validation/generated/rolling-pool.json (48ebb26) | feed idle loop external goals | specific | live-used (07-15) | was a no-op parsing wrong shape |
| census-tick / validation-dispatch-tick / validation-grade-tick families | activity templates (07-20) | self-census + 4-tier validation | specific | dormant (never fired unassisted) | load>=8 gated; conductor only enqueued |
| compose_lesson corpus + COMPOSE_LESSON_GUIDANCE | concept-db (Authorization: ApiKey scope) + feature-compose.ts:2897 | drafter read-at-use-time teaching channel | general | live-used (read channel open after adfe470) | 11 classes since 07-04; canned text not rich critique (08-26); JSONL writer stored preamble until 107a75c7 |
| concept-db two-stage KNN | concept-db adfe470 | semantic recall within budget | general | live-used | 48s -> 840ms (08-30) |
| hopeless() seal + escalation uiQuestion_write | dev-vessel gap-to-feature + resolveUiWritePassthrough -> pinned 127.0.0.1:8270 | escape for sealed gaps to a human | general | broken (delivery to unread vessel) | 248 escalations 0 answered (09-22); 421052c apply side fixed only |
| escalation_disposition_apply / solicitation-outcome-scan | dev-vessel | apply human answers | specific | starved | nothing to read |
| stateful-ui-vessel :8270 | container unit | old UI question store | — | fossil acting as live sink | replaced by human-surface-vessel :8310 |
| self-recovery-tick / self-recovery.timer | scripts/substrate | restart unhealthy units; ESCALATE | general | partly inert | timer next_elapse=0 (08-11); ESCALATE -> log line 1071x (09-11) |
| self-operational-health.ts | scripts/substrate (timer) | detect operational faults, emit gaps | general | broken scope | watches 14 timers / 0 services (09-19) |
| warn-baseline-drift.sh | scripts (f06e1470) | runtime vs clone byte check | specific | live on deploy only | not run after compose rollback (08-09) |
| gap-compose.service / watchdog-tick / GapDrainObserver / in-process nudge | dev-vessel + systemd (b8feccd, 69d6a21) | pick up new gaps for compose | general | live-used since 08-09 | 13-min autonomous close 04775a7 |
| sweepPendingLandVerifications / landed_verified close | dev-vessel | close gaps only on landed verified sha | general | live-used | honest backlog 685 open (09-05) |
| gap_lifecycle_scan autoCloseStaleGaps | dev-vessel | TTL close | general | live-used | 69% of closes are expiry (08-28) |
| llm-resolver model policy + failover walk + last-resort | llm-resolver-vessel model-policy.ts, index.ts OPENAI_WIRE_PROVIDERS | arm selection + provider failover | general | live-used, defects | 1/1 cold-start cliff :113; 401 no cooldown; retirement not restart-durable; no CAS; llmQuotaState key-presence |
| llm-completion-dispatch failover + robust JSON hoist | dev-vessel (d08774a, ef54c05) | multi-producer failover; parse fenced JSON | general | live-used | 07-15/07-20 |
| trace emission for compose/cutover | dev-vessel softRefuse chokepoint, cutoverApplied (4afd4c1, e8e3fec, c5f7efb) | self-dev pipeline traced | general | live-used | apply_proposal_as_patch, gap_to_feature, patch_with_tools still untraced (08-29) |
| exemplar selector | activity-api (7c34185 + substrate fixes) | extraction stage exemplars | specific | live-used after 09-10 | 0 -> 315 rows |
| reach_history rollup | activity-api 1150223 | trajectory time-series before pruning | general | unknown (needs weeks) | 08-08 |
| federation transport relay anchor | federation-transport-server.ts | libp2p circuit via relay | general | defective (reads relay once at module load) | 7,333 failures (08-10); 19,348 restarts with empty env (09-11) |
| render-unit.sh self-repairing ExecStartPre | scripts/substrate (08-19) | repair hollow file: deps | general | live-used after propagation | — |
| spectral-gap / SF blend / TTSA / lambda2 gate | activity-api spectral-gap.ts, activities.scoring.ts, choice.ts, generative-frontier-gap-tick.ts | architecture-doc dynamics | general | dormant (metrics-only / default-off / deadlocked) | 07-24 |
| deterministic:verified-* oracles | goal-host | deterministic reach verification | specific | dormant (0 firings/10h, 08-03) | — |
| env_gate_fulfilled | dev-vessel src/resolvers/env-gate-fulfilled.ts | — | specific | broken (calls /v2/substrate/gap/env-gate-fulfilled which no vessel mounts) | 08-29 |
| v_shape_pattern_performance (023) | activity-api sql | computed view | — | fossil (zero readers; poisons cold-boot inserts) | 09-22 |
| SATISFIER_FORBIDDEN_FS_WRITE | goal-host index.ts:9042 | forbid bare satisfier writes to source | specific | live-used | does not cover store writes (09-05) |

# PROBLEM SPANS (first_seen -> last_seen within this shard, recurrences = distinct dated instances)
- write-read-mismatch: 07-14 -> 09-22, >=15 instances.
- false-verification: 07-12 -> 09-15, >=14.
- hollow-landing: 07-25 -> 09-19, >=12 commits.
- autonomous-regression: 07-04 -> 09-22, >=9.
- sync-deploy-drift: 07-14 -> 09-22, >=15.
- endpoint-routing (pinned/hardcoded/envelope): 07-13 -> 09-22, >=8.
- env-gating: 07-14 -> 09-11, >=10.
- llm-plane misdiagnosis ("all providers dead" while hub funded / keys empty): 07-20, 07-23, 07-26, 09-11, 09-14 => 5 recurrences; real causes: disjoint arms, no failover, empty keys, invalid anthropic key.
- narrowing-duplicates: 08-10 -> 09-14, >=6.
- gap-content: 08-10 -> 09-19, >=6.
- calibration-seal: 08-28 -> 09-22, >=4.
- dormant-mechanism: 07-20 -> 09-19, >=12.
- trace-store-db (SurrealDB planner traps): 07-14 -> 09-22, >=9.
- selection-learning: 07-16 -> 09-19, >=8.
