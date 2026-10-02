# memory-1 — operator memory cache, notes 1–75 (sorted), raw extraction

Source: `/home/avi/.claude/projects/-home-avi-documents-work-substrate/memory/*.md`, first 75 by `ls | sort`
(`deploy-anywhere-…` through `feedback-subagents-on-live-substrate-must-be-write-forbidden`). 749 files total; this shard covers 1–75.
Written notes per source file (batch order), then a regrouping by problem-class key, mechanisms, principles at the end.

---
## Batch A (files 1–20)

### deploy-anywhere-proven-and-git-selfalter-2026-07-12
- [federation-p2p] 07-12 bare `avigopal/substrate:dev` booted as spoke of syzygy.host (138.197.116.56; hub 18080/18100/18101, relay 30333); `spoke-federate` → 11 `@anywhere-proof` mirror rows in hub registry; goal on spoke `:28210` walked hub templates, traces landed in HUB store. Toy goal reached:false (walk quality). Outcome: worked (connectivity).
- [sync-deploy-drift] Self-alteration git contract: `SUBSTRATE_GIT_PAT` → setup-git-push credential helper + writable clones of 16 vessel repos + super-repo. Trap fixed `d3253945`: credential-less boot seeds super-repo as bare tree (no .git), later PAT could never upgrade (clone refuses non-empty dir) → init-in-place + fetch + `checkout -f -B dev origin/dev`. Worked (proven on spoke).
- [sync-deploy-drift] Docker Hub tags stale (pre-fix digests bfdf7d80/15844153); rebuild dev=1fb3f80e20a4 obsidian=11cdc40448e3; push pending user-run.
- [endpoint-routing] goal-host has NO `/goal-status` HTTP route; status via MCP goal_status/journal.

### feedback-a-channels-own-reporting-is-not-evidence-about-the-channel (08-18/19)
- [selection-learning][false-verification] Operator twice published "credit channel one-directional (0 α, 12 β)" — wrong; 4-minute intervention: `universal-tool-fallback` α 261.07→261.77, `satisfier:llm_completion` α 5.06→6.34. Credit flows. The 12 β penalties never happened (`alphaBetaDelta` `[]`), counted log lines.
- Reporting lies enumerated: `β-penalised` log line asserted withheld penalties; `penaliseHollowTemplate` returned dBeta:2 after logging `beta-penalty REJECTED (404)`; `oracleLabelWritten` was correct (human-verdict latch); `alphaBetaDelta` accurate in scope. "Class recurs below its own fix" — same log-lie fixed once, reappeared in sibling branch and return value.
- [selection-learning] `thompson_posterior` synthesizes Beta(1,1) `loaded:true` for any id incl. fake (`satisfier:definitely_not_a_real_shape_xyzzy`) → "245/486 arms never graded" was fabricated; real = 7 arms with 5+ outcomes frozen at prior (`composition_coverage_report` 40 success/3 fail, posterior never moved).
- LAW: a channel's reporting is not evidence about it; intervene and observe the store; probe a fake key before counting "things in state X".

### feedback-a-checker-whose-error-path-looks-like-success-always-reports-progress (08-28)
- [false-verification] Three operator monitors in one night reported success on failure: `case *sha=None*` missed `sha= None`; `grep -q behavioral_claim` matched name of an unimplemented invariant (reported LANDED on inert 1-line fragment); nested `docker exec bash -lc` quoting broke grep → printed `IMPLEMENTATION LANDED` and `impl_present=0` together.
- LAW: test the checker against a known-false state first; loud error branch; grep for the mechanism not the name.

### feedback-activities-are-earned-by-doing-not-declared (07-10)
- PRINCIPLE (operator verbatim): activity created by DOING — walk reaches, reach-gate recognizes, ribosome crystallizes. Hand-authored template upload = same failure as unvetted resolver mint. Resolver-minting bootstrap phase is done.
- [composition-crystallization][goal-walk-floor] Instance: walk picked `satisfier:concept_create_write` but wrote NOTHING to concept-db (NL→write-payload blocker). Fix = make the system able to do it, not hand-author.

### feedback-activity-api-stores-eventually-consistent (07-14)
- PRINCIPLE: activity-api stores in the same identity group are eventually consistent (anti-entropy, upsert by id+version, never CREATE-only). 
- [federation-p2p][trace-store-db][node-locality] At the time hub vs substrate-live did NOT converge (no bidirectional sync; mirror one-way/lossy; import CREATE-only) — violation. Store-less executor writing to shared store proven (exec_kgm6wjiw on min → hub DB). Fix path: origin_substrate_id+version → UPSERT import → incremental cursor → `trace_replica_sync` rhythm. Outcome: planned/unknown.

### feedback-a-detector-must-be-proven-to-COMPLETE-not-just-to-exist (08-04)
- [false-verification][autonomous-regression][dormant-mechanism] Host-side autonomous-regression detector from `676cb859` had 0 completions and 132 FAILURE since Jul 28 while reported working. `set -euo pipefail` + grep no-match killed script; guards unreachable; first-run bootstrap impossible; ALERT branch SIGPIPE-fatal. Fixed `cffc9489` (`|| true`).
- `.pullsync-testbaseline` goal-host-vessel=9 seeded from already-regressed tree (`4fa92b3` made `repairSignatureOf` async).
- LAW: detector exists ≠ runs; prove completion; exercise ALERT path; sweep the block when one instance found.

### feedback-a-dirty-index-silently-freezes-the-glue-layer (08-02)
- [sync-deploy-drift] In-container super-repo clone 10 commits behind origin/dev for 11h, 37 consecutive ff-only failures, no signal. 126 staged paths left by `vessel-mitosis-cutover.ts` failure paths after `git add`. Staged content = drafter-hallucinated paths missing `repos/` prefix [drafter-quality]. Fixed `c8b2e6e` (unstage on failure, recorded in operations).
- LAW: check in-container clone HEAD vs origin; repeated silent skip needs counter + fixed-id gap; never leave index dirty.

### feedback-a-field-that-accepts-your-data-is-not-a-field-that-means-it (08-08)
- [write-read-mismatch][composition-crystallization][directed-overshoot] Operator sent borrowed-pathway lineage in `parent_goal_hash/parent_path_signature` (POST /v2/goal-paths) per a 9-agent audit; the fields mean SUB-GOAL lineage with CC1 scope-narrowing assert → 400 → reused walks (cover=0.50, borrowed_from d925f1c6c299204e) recorded NOTHING. Worse than before. Caught because same commit added `res.ok` check. Filed `reuse-lineage-has-no-field-of-its-own` (needs `reused_from_goal_hash`).
- LAW: a field that accepts data is not one that means it; read the consumer; ship the falsifying measurement in the same commit; "already exists" from an audit is a pointer, not verification.

### feedback-a-negative-result-is-unattributed-until-a-positive-control-shares-its-address (09-15)
- [false-verification][endpoint-routing] Five false alarms in one session: host checkout vs `/workspace/git/vessels/<v>`; unit `llm-resolver-vessel` name (systemd fabricates inactive for nonexistent); `X-Api-Key` vs `Authorization: ApiKey` → different concept-db scopes (5 rows vs 13); dev-vessel vs stateful-ui :8270 ownership; discovery unauth + envelope `{impulse:{pointer}}` vs top-level `pointer`.
- Code-reading false premise: `changesAreTestOnly` (feature-compose.ts:856) dead → filed gap "substrate cannot write a test"; control: 9/400 substrate commits test-only landed (462fd9a, 54c3c2d, …). `reachabilityHardFail` returns hardFail:false when facts empty. A false-premise gap family burned 31 gaps/12 attempts.
- [memory-recall] Why six prior memory laws failed: indexed by instance surface, not invariant — each recurrence wears a new interface. (Direct statement of the "different hat" failure.)
- LAW: before believing any negative, run a positive control through the same address; verify as the CONSUMER; code reading is a negative needing a control; interfaces should echo resolution context.

### feedback-a-renamed-field-across-a-boundary-is-the-dominant-silent-failure (08-31/09-01)
- [write-read-mismatch] Four instances: (1) db-maintenance integrity repair never ran: producer `activity-api/src/routes/db-admin.ts:206` emits `violating_rows`, consumer `scripts/substrate/db-maintenance-tick.ts:83` reads `count ?? violation_count` → 59/59 runs `actions:[]`; (2) compose lesson mirror POSTed to DISCOVERY_ENDPOINT not concept-db; (3) repair parser read `fix.file/old_string` while prompt asked `replace_lines`; (4) operator read alpha/beta vs thompson_alpha.
- LAW: diff producer emit vs consumer key names; constant counters = suspect; timer scripts have no shape contract (law 2).

### feedback-a-retraction-in-prose-is-not-a-retraction-in-state (08-29)
- [gap-content][narrowing-duplicates] Refuted gaps left `status:open` → 3 of 6 recent feature_compose runs on disproven premises (`test-file-edits-never-reach-mitosis-staging…`, `seam-extraction-round-trip-is-flaky…`). `pickMostLandable` reads status. LAW: retract = `status:"rejected"` in same write.

### feedback-behavior-must-be-shape-driven (07-12)
- [env-gating] `LLM_FALLBACK_MODEL` added to /etc/substrate/env after 2/3 llm_completion units started → couldn't fail over during Anthropic credit outage. Gap `env-drift-between-file-and-process` superseded by `behavior-config-not-shape-driven` (providerCreditState/llmRoutingPolicy shape). Sibling env instances: env-pinned model defaults, PEER_FANOUT_MODE, REUSE_BEFORE_MINT, priority-weight knobs. LAW 1 origin.

### feedback-behaviors-are-activities (07-11)
- LAW 2 origin. How: resolver only if primitives can't express; mint activity via `activity_create_variant` (category enum feature|bugfix|refactor|tool|infrastructure|meta); tag `boredom_target_template`/rhythm family; run via target_template_id once. Instance `docs-mgmt:docs-decision-solicit`.

### feedback-boredom-is-condition-driven-selection (07-10)
- LAW 5 origin. Mechanism: boredom-vessel `refreshSubstrateState` folds gap demand, learningMode per_shape_boost into `priorityWeightByShape` (max-wins) × `ucbScore`. Rhythm fold landed boredom-vessel `406d311` (live: `rhythm read: 1 actionable, top=gap-closing(1.63)`, 391 open gaps). Conductor `boredom_enqueue`-to-file nothing reads → superseded (fossil).
- [selection-learning] UCB cold-start ∞ starvation (1h outcome TTL + in-memory momentum + ~45 restarts/day) fixed substrate-authored `4706b894`.
- [false-verification][hollow-landing] patch_with_tools cutover rolled back UNFAVORABLE despite clean typecheck — "reach-on-rolled-back" bitten 3×, gap `reach-gate-passes-on-rolled-back-patch`; operator completed cutover by hand.
- [spend-envelope-throughput] boredom envelope 10min/1 → 2min/3-concurrent via `zz-operator-envelope.conf` (drop-in = env/config gating). Gap `gap-pool-event-driven-selection` (WS subscribe → debounced selection).

### feedback-check-before-filing-five-false-positives-2026-08-23
- [false-verification] Five would-be findings died: per-test set-difference gate already at `vessel-mitosis-cutover.ts:2334`; law-7 triple already at `gap-lifecycle-scan.ts:586-624` (real defect: scan hasn't RUN since 08-18 → [dormant-mechanism]); compose-busy already filed (`gap-edit-intent-compose-lane-lands-nothing`, `gap-mt0kcoyt`); raw_excerpt 1500 chars reaches drafter (`feature-compose.ts:1442`); pending re-derived from git.
- Base rate: observational legs survive ~7/7, causal legs 1/7.
- [sync-deploy-drift] Stale clone reports a real commit absent (`81c698940943`; container submodule head 08-16, `/vessels/goal-host-vessel` no .git, host `547383a`); `find -maxdepth 4 -name .git` misses submodules.
- [goal-walk-floor][spend-envelope-throughput] Compose lane single-occupancy: BUSY → falls through to walk which cannot edit (`fs_edit`, `fileEditResult`, `code_modification_proposal` unproducible) → capability gap filed naming wrong shape; transient capacity rendered as permanent capability verdict. Filed `compose-busy-falls-through-to-a-walk-that-cannot-edit`. Rewording goals only moves between dead shapes.

### feedback-ci-must-run-on-a-compliant-vessel-not-github (08-05)
- LAW: GitHub CI antipattern unless on a compliant vessel; post-landing verification = activity + shaped impulse keyed to landed commit.
- [dormant-mechanism] `POST /v2/activities/ci-result` never executed in 741 runs (unparseable workflow, retired hostname). `host-pull-sync.sh` host-side detection-only to operator log.
- Operator error: fixed the dead CI lane in place (reviving antipattern).
- Mechanism landed `2ddcac0` (development-vessel): reused `resolvers/test-suite.ts` `test_suite` shape (had never run, fetched nonexistent `/api/test-store/summaries`); runs `bun test` via shell tool; `vessel_mitosis_cutover` calls it after every landing, rides on `cutoverApplied`; red suite files substrateGap; counts from bun SUMMARY; `ran:false` if no summary. Carries `verified_root`+`verified_head`. Verified 02:05Z 159/4/163 at a9742a9.
- [sync-deploy-drift] THREE source trees: `/workspace/git/vessels/<v>` (tracks origin), `/workspace/git/super-repo/repos/<v>` (lags; 42547b2 two days stale), `/vessels/<v>` (runtime mirror). First version verified the wrong tree → 9 phantom failures.
- NOTE (from MEMORY index): this post-land suite later found SILENTLY DEAD 08-31→09-28 on dev-vessel/activity-api (shell 30s default kill; fixed 5e9a0b2) → outcome for 2ddcac0 = worked then reverted/dormant.

### feedback-clients-conform-to-substrate-idiom (07-16)
- LAW: clients conform to substrate idiom. [endpoint-routing][codebase-bloat-fossils] activity-api `default:`-arm gateway (defa169) was wrong mint, reverted; resolve-forward re-homed to discovery-vessel (findByShape, forward, ApiKey passthrough).

### feedback-concept-db-is-the-prose-knowledge-vessel (07-10)
- PRINCIPLE: concept-db = general prose/string-typed knowledge vessel. Reuse `concept_edge` (contradicts/resolves_to/derived_from — INERT, zero consumers) instead of minting `superseded_by`. Additive delta: provenance on concept_edge (gap `concept-edge-no-creator-trace-provenance`), `supersedes` edge type (schemas.ts:55), resolve path. Prove via docs-rhythm catching stale `metabob-devbob`.
- [dormant-mechanism] contradicts/resolves_to edges inert.

### feedback-concept-sync-learned-relevance (07-07)
- [human-surface-escalation] vault concept-sync 6-source-type static filter in syzygy `data.json` = stopgap; should be learned relevance. Outcome: unknown/open.

### feedback-consumed-means-verified-by-a-trusted-activity-and-autonomy-is-gated-by-push-capability (08-09/10)
- PRINCIPLES: `consumed` = verified by high-confidence activity (open/consumed/retired); gap closing = cluster/prioritize/ask any interface; autonomy gated by push capability not role group.
- Existing capabilities (reuse): `gap_lifecycle_scan` 739 inv/30d, `vessel_gap_to_cluster` 160, `recurring_pattern_cluster` 44, `signature_cluster_scan` 23, `rhythm-conductor-tick.ts:67` drain. Unproven whether consumption queue populated.
- [federation-p2p][false-verification] push capability: first "has push" (token in env), then "cannot" (no credential.helper), then re-corrected: substrate landed `04775a7` itself 08-10 00:00:25 via vessel_mitosis_cutover. Only an observed push answers. `orphaned-capability-git_push` gap marked hopeless (different route). Masking autonomy units on federation was wrong.

---
## Batch B (files 21–35)

### feedback-corpus-test-a-gate-BEFORE-dispatching-it-not-after (08-03)
- [gap-content][hollow-landing] 130 open `edit_intent_route` gaps with gap-id-chain-looking summaries; operator dispatched boredom admission guard regex; post-hoc corpus test: matches 1/121; stronger version 0 (every chained gap has 158–432 chars real content; logs truncate ~110). Landed `c76b8bb` near-no-op + mangled indentation. `sanitizeGoalText` already stripped prefixes. LAW: corpus-test a filter before dispatch; near-no-op on corpus = wrong premise.

### feedback-decompose-before-behavior-change (07-13)
- [drafter-quality][codebase-bloat-fossils] goal-host index.ts 6,800 lines defeated 8+ compose rounds (TS1005 brace breaks, inert patches); 17-line satisfier-pick.ts extraction landed first-try `83b254b`; ~2k feature-compose.ts converged in 2 rounds. Gap `policy-load-bearing-files-within-drafter-splice-reach` (detector: N rejections on big file → propose decomposition). PRINCIPLE: extract seam first (no behavior change), then behavior change.

### feedback-decompose-substrate-edit-goals-to-one-site-each (08-02)
- [drafter-quality][goal-walk-floor] Recipe proven: `154390b`, `11ba16d`, `2585053`, `1d97038` landed no operator hands. One edit SITE per goal (10,260-line file accepted 4 single-site goals, rejected 3-hunk), quote line verbatim, adjacent line if not unique (`no_unique_anchor`), "change nothing else", "MUST typecheck", give reason. Law-13: hand-decomposition is itself a gap.
- Two of three substrate commits earlier same day were harmful while green [hollow-landing][autonomous-regression].
- [endpoint-routing] after self-landing, vessel restart → MCP cached goal-host endpoint stale (`127.0.0.1:18401`); `/run-goal-async` 404.

### feedback-derive-canonical-facts-from-intent-provenance (07-10)
- [docs-drift] PRINCIPLE: canonical facts derived from recorded intent-provenance (openspec proposals, commit bodies X→Y, trace goals), not regex over artifacts. Superseded dispatch a01ffbe3 regex-scraped. Example rename sources: openspec `2026-06-25-substrate-root-rename-and-repo-hygiene/proposal.md`, commits `94b38dd5`, `7a21afc2`.

### feedback-diff-a-schema-change-against-info-for-db-not-against-the-migration-file (09-04)
- [trace-store-db][drafter-quality] Migration 205 (`9646cf8`, activity-api, unpushed, never applied) proposed REMOVE+DEFINE `v_paradigm_execution_traces` from premise read off migration 069; live view had 41 fields vs 27 → would drop 15 fields and replace `(variant_id ?? activity_id)` with `activity_id` (Thompson arm key). Consumer reads `metadata.state_signature` anyway → no effect. `ExecStartPre=-` discards migration exit status → partial application with /health 200.
- LAW: diff against `INFO FOR DB`; REMOVE+DEFINE from old migration = revert of later migrations.

### feedback-directed-gap-handoff-needs-directed-true-2026-09-28
- [directed-overshoot][false-verification] `gap_to_feature` without `directed:true` → feature-compose.ts ~6272 autonomy-scope floor logs `WITHHELD FAVORABLE`; verdict UNFAVORABLE with all edits applied, tsc 0, tests at baseline; no gate named. Operator handed resolve-URL gap back 4× misreading as drafting failure. Supersedes older note "gap_to_feature drops directed" (it passes through at gap-to-feature.ts ~3911). Containment rule set by operator blocked system's own fix to its tool plane.

### feedback-dispatching-experiments-contaminates-the-lanes-own-success-metric (09-12)
- [spend-envelope-throughput][false-verification] Authoring reach 19% (53/273) → 15% (42/269/24h) → 13% (5/36/180min); excluding ~10 operator composes → 5/26 ≈19% baseline. First causal story (exploration from neutral-prior reset) wrong: gemini had worst drafting EV (0.125). No operator tag in compose-report journal lines (grep `operator:avi-` = 0) → measurement gap. cap=1 slot.

### feedback-dispatch-time-selection-is-one-shaped-policy (07-14)
- [env-gating][selection-learning] Tool-set/model/effort = one shaped selection policy. `DEFAULT_LLM_TOOLS` constant, template `tools:[]` field = law-1 violations; moving to template author isn't closure. `tool_usage_patterns` exists but no read-back edge; `toolUsagePatterns` discovery found:false. Gaps: `tool-affordance-not-a-shaped-impulse-2026-07-14`, `llm-wire-model-selection-hardcoded-2026-07-14`, `llm-fallback-order-hardcoded-not-learned-2026-07-14` (MERGE). [narrowing-duplicates] near-duplicate gaps.

### feedback-docs-are-the-human-interface (07-?)
- PRINCIPLE: docs are human interface, not runtime input; corpus = all human-facing docs; north star = doc → claim-shapes in concept-db. Vessel docs are submodules not populated in container clone [docs-drift][sync-deploy-drift].

### feedback-docs-timeless-behavioral (07-09)
- LAW 9 origin: no dated status, instance names, gap ids in docs.

### feedback-dont-rob-substrate-self-maintenance (07-10)
- LAW 6 origin. Three hand-completions: mitosis cutover finished by hand (substrate later self-cutover `e758df8` → premature); observability block; `author_new_resolver` satisfier scaffolded `// TODO` stub, operator wrote 228 lines [hollow-landing][drafter-quality]. Gaps: satisfier-author-new-resolver-scaffolds, reach-gate-passes-on-rolled-back-patch, cutover-skip. Concept `concept_K4tiR-Zy9THy`.

### feedback-drafter-can-only-replace-the-anchor-line (08-03)
- [drafter-quality][hollow-landing] boredom-vessel/src/index.ts: two consecutive autonomous commits (`479016a` + next) — drafter replaced only the last quoted (return) line; cache still overwritten before guard, duplicate assignment; typechecked, `reached: yes`, semantically no-op. LAW: drafter's unit = ONE anchor line; anchor on the wrong line; N-line change = N ordered goals; read resulting code via `git show sha:path`. Every gate asks "did an edit land and compile", not "does behavior change in the asked direction".

### feedback-duplicate-genres-and-arm-fleet-decisions (07-19)
- [federation-p2p] Decisions: identity = namespace boundary (replica vs foreign namespace); LLM arms one provider/unit as config data (`llm-arms.json`/`LLM_ARMS` → `render-llm-arms.sh`) [env-gating: arm-list-as-shape gap filed]; findability not relay-gated (direct = punchthrough; relay only NAT fallback); Obsidian main.js git-tracked with co-landed rebuild. Specs openspec/changes/2026-07-19-{vessel-duplicate-genres,relay-findability-replication,llm-arms-data-driven,obsidian-pebkac-config}; law review ab4f0642.

### feedback-ensure-docs-match-reality-before-reasoning-from-them (09-16)
- [docs-drift] Operator embedded row counts/dates/file:line into docs; out of date before push. LAW: write the invariant + failure mode. Invariants: detector nobody invokes emits silence; measurement ≠ governor until something acts; dead periodic producer serves stale value; record with only type+reason is a label. `IMPLEMENTED_DORMANT` largest audit class [dormant-mechanism]. Example: `runtimeTracingMiddleware` exported but only `app.use` inside a comment; `metadata.runtime_trace` true on 0 of 97,000 rows [dormant-mechanism][trace-store-db]. Doc can be wrong in system's favor → rebuild existing thing [codebase-bloat-fossils].

### feedback-execution-parity-contract (07-11)
- PRINCIPLE: floor ReAct parity / ceiling learned pathway / middle first-last-mile. "899 successful picks with zero compounding" [selection-learning][composition-crystallization]. Classify shortfall by tier: floor = info availability; middle = pathway reuse (highest leverage); hollow = oracle calibration.

### feedback-falsifier-none-means-no-machine-checkable-predicate… (09-14/15, 57KB — the densest note)
- [gap-content][false-verification] `classifyFalsifier` (`development-vessel/src/resolvers/substrate-gap.ts:418/437`) = class enum: class1 (`expected_literal` PRESENT=FIXED, or `hardcoded_url` PRESENT=DEFECT, + `edit_site`), class2 (resolvable shape), unresolvable, none (expiry-only). Census live store 7,323 gaps / 1,830 open: 1,609 `none`, only 34 carry `falsifier_predicate`; 1,575 (97.9%) no predicate; class2 43 / class1 13 / unresolvable 11. Substrate's own gap `gap-falsifier-runs-18402-times-a-day-and-assigns-a-predicate-0.9-percent-of-the-time` (12.8/min, no edit_site → unlandable) [dormant-mechanism][spend-envelope-throughput].
- [human-surface-escalation][write-read-mismatch] `human_disposition_answer` 1 occurrence fleet-wide = write at `escalation-disposition-apply.ts:175`, ZERO readers; answer truncated 2000 chars; only effect: exemption=3, failed_attempts=0 (unseal). Counterexample: answer 06:48:10 → substrate landed `1121067` 07:23:23 (fire-and-forget `void fetch(lastDraftEndpoint` → AbortSignal.timeout(60000)) [worked]. Fixed gap stayed open w/ falsifier none 2h → "a completed fix with no predicate is indistinguishable from an unstarted one". Proof case unfixed since 08-29 (`concept-usage-record.ts` EDIT_SITE in prose).
- Envelope: `panel_id` must be under `pointer`; `readAnswersByPanel()` reads `${WORKSPACE_ROOT}/interactor-log/uiFeedback_write.jsonl`; top-level panel_id invisible; answered 31→34, applied 0 [write-read-mismatch].
- LINK 3 landed `4e5a603` (Substrate Autonomous 09-14 13:52:52): verifiabilityCredit +0.5 for class1/class2 in selection; class1 pick share 0%→43% (n=7), none still picked. [selection-learning] worked (indicative).
- LINK 1 landed `d3e1ca2` (operator, DevBob Assistant): escalation-disposition-apply lifts `EDIT_SITE:/EXPECTED_LITERAL:/VERIFY_SHAPE:` into classification_metadata; 12/12 tests, 10/10 behavioral. Lane attempted 3× and failed at drafting — bootstrap exception. Limitation: no `DEFECT_LITERAL:` for removals. Worked (demonstrated `concept-usage-record` edit_site None → set).
- Four-link chain (09-14): 1 feedback consumable; 2 gaps machine-closable (1,609/1,835 none); 3 selector prefers verifiable; 4 lane capacity (one slot; 18 nudges/h DROPPED; `consumption-gate-is-inert-because-gapclasskey-does-not-strip-8-hex-discriminators`) [spend-envelope-throughput]. gap-compose.service inactive while slot held by in-process compose.
- [gap-content] Lane picked the NUL gap (unlandable, `zero_behaviour_delta`), minted narrowed child, held slot while 3 landable class1 gaps dropped. [narrowing-duplicates].
- [hollow-landing][autonomous-regression] `38e72ae` (the-unexamined-rung-is-a-one-way-latch): 2/3 — `examUnexaminedAllTime` only ever assigned null → all_time == in_window. "A field that names a thing it cannot contain is worse than its absence."
- Traps: `docker cp` into `/workspace/git/vessels/<v>` erased by pull-sync `reset --hard` [sync-deploy-drift]; host submodule 83 commits behind; landing ≠ live — compare runtime file mtime vs serving PID start; development-vessel restarts ~every 3 minutes (8 PIDs / 30 min).
- [false-verification] literal-needle durability test falsely reports reverts (`abbfa4c` refactored by `7c6c3ff`); of 22 REVERTED_OR_MOVED indeterminate; use `git merge-base --is-ancestor`.
- [drafter-quality] Plausible draft editing downstream of selection = hollow; semantic-gate adversarial refuters 2/2 (0.95, 0.92) overturned single-judge pass. Mechanism: semantic-gate refuter panel = worked.
- `landed_verified` census over 5,956 closed: none 4,654; expired_not_redetected 970; landed_verified 109; stale_low_value 69; persistent_compose_failure 31; operator_directed_dormant_withdrawal 29; producer_now_exists 19; fix_landed_and_verified_by_consequence 11; false_premise_retracted 20. `mispredicted_lands` on 1,762 gaps (912 open).
- [memory-recall][test-residue-live-state][write-read-mismatch] ⚡ `interactor-log/uiFeedback_write.jsonl` was TRACKED in super-repo; pull-sync `reset --hard` destroyed answers (65 lines/13 panels → 53/4; last commit 4e4170a8 09-07); explains zero question lines. Fixed operator-landed `a009e1d9` (.gitignore:252,253 incl. `/load-attribution/`); fix itself wiped 127 lines on first sync (reset --hard deletes untracked-now files) — backup/restore sequence. Substrate could not compose it: goal dispatch needs `repos/<vessel>/src/…`; lane grounds edit_site under runtime root → `no_groundable_target` → gap `the-substrate-cannot-compose-a-fix-outside-repos-vessel-src` [goal-walk-floor].
- Land signal: `landedCommitVerdict` (`gap-to-feature.ts:2283`) `git log --grep <gapId> --since=14.days` = RELAND detector; only 3/16 derivable because 13/16 commits name the route-edit child. Filed `land-signal-derivation-only-matches-a-gap-id-in-the-commit-message`. Real closure = `sweepPendingLandVerifications()` (`gap-to-feature.ts:2411`, called at :3185): needs `pending_outcome_verification` sha + predicate; checks ancestor → reverted → verifyGapConditionAsync. Result `checked=25 closed=6` (4 Substrate Autonomous / 2 DevBob). Code comment: "13 gaps carry pending_outcome_verification, 11 have no predicate".
- `substrateGap_write` validates (rejects empty summary) and MERGES classification_metadata (omission doesn't delete). Flat pointer envelope silently drops predicate (success:true) vs `gap:{classification_metadata}` [write-read-mismatch]. Writing a gap shells `systemctl start gap-compose.service` (`SUBSTRATE_GAP_SKIP_COMPOSE_TRIGGER=1` process-level) [env-gating].
- [calibration-seal] ⚡ `hopeless(g)` seals by CATEGORY (attempts ≥8 && lands 0) from `/workspace/expectation-calibration.json`: detector_coverage_gap 0/15, measurement_integrity 0/12, learning_loop 0/14 sealed; selection_defect 3/4, systematic_failure 56/800. 5/9 operator gaps sealed on arrival. Escape: bounded per-gap exemption (3 attempts, resets failed_attempts). `drop` closes as `human_dropped` (poisons census).
- [false-verification] Operator mis-closed 4/11 (landed_verified 121→117): partial fixes; cited commit INTRODUCED the defect (`50f7560`, inverted polarity). Re-armed on `goalAchievedNotJustLanded`.
- [drafter-quality] Full loop observed 09-15 03:39–03:42: lane picked re-armed gap in ~3 min; drafter wrote `backfillReachHistory/reconcileReachHistory` but never called them; semantic gate refused (`unreachable_symbols`, hard_fail). Refused compose auto-minted `recommit-…` child falsifier none [narrowing-duplicates]. LAW: name the call site, not the identifier; default drafter failure = unwired function.
- [autonomous-regression][false-verification] `5499f5c` (Substrate Autonomous 09-15T04:56Z, FAVORABLE) implemented `predicateLiteralNotUnique` from operator gap — inverted polarity, wrong tree (workspaceRoot vs runtimeRoot `/vessels`), literal as regex, never checks uniqueness → self-sealing (disarms gaps filed to fix it, loses +0.5). Escape via `hardcoded_url`. (MEMORY index 09-22 says the class1 arming guard NEVER fires — `repos/` strip ENOENT — later recurrence.)
- [trace-store-db][memory-recall] ⚡ Gap store lost a session's writes ~09:23 (stale-snapshot wholesale write): 16 gaps, predicates, 9 landed_verified closures (119→110). Gap `concurrent-wholesale-writes-to-gaps-json-silently-revert-metadata-corrections` destroyed by the race. Recovered 16/16 from `$CLAUDE_JOB_DIR/tmp` payloads (luck); layered state lost (land stamps 12+→1, exemptions 5→0). LAW: git is the only unimpeachable record; keep posted payloads.
- `grep -c` on JSON store = line count (phantom oscillation).
- Session end: `f083cf0` (`landedCommitViaLineage` defined+wired) and `77e419a` (#10, 18 slot objects) Substrate Autonomous.
- [spend-envelope-throughput][sync-deploy-drift] Three-way conjunction tree-clean ∧ lane-free ∧ llm-reachable; pull-sync mirrors+restarts llm-resolver in same pass that heals the tree; #10 burned ~20 attempts. Self-reinforcing break: compose breaks tree → nothing commits → persists; `runtime-drift` reports only (`repair not armed (pull-sync owns mirroring)`), ~10-min mirror.
- [hollow-landing] ⚡ Gameable metric: "zero `{{…}}`" satisfied by `68fe034` substituting plain literals (`cwd:"resolveCwdFromSlot"`), 14→10 but worse.
- [false-verification] Fail-open gate `feature-compose.ts:2068` returns `{addresses:true, verified:false}` when judge unreachable, nothing reads `verified`; both fail-opens in 24h approved unverified work. Filed `refuseWhenJudgeUnavailable`.
- [autonomous-regression][env-gating] `f4bae3c` removed `continue` for keyless providers, passed empty key → OpenAI SDK throws at module scope → llm-resolver crash-looped 19 restarts, llm_completion left discovery; every compose fleet-wide failed; self-sealing. Filed `emptyKeyPlaceholder`.
- LAW: refusal → one missing fact → improved attempt; a prohibition never works, only an ADDRESS; put guidance in the GAP not the dispatch goal (lane reads the gap).

---
## Batch C (files 37–52)

### feedback-fire-and-forget-on-a-learning-edge-is-a-silent-data-loss-path (09-12)
- [write-read-mismatch][selection-learning] Operator's own `[fc-draft-model] graded` logs: 5 lines, policy recorded 3 observations (~40% overstated); `void fetch().catch(()=>{})`. LAW: log inside catch; success line after response; own success logs = upper bound. Review question "if this write fails, who finds out?"

### feedback-gap-metrics-triple (07-11)
- LAW 7 origin. Baseline 07-11 02:45 (n=628): 53 closes/24h; closed median ~0h p90 11.1h; open median age 37h p90 93h (n=426); durability 6 of 7 multi-instance classes reappeared after close (route-edit ×107, recommit-route-edit-semantic_reject ×5) [narrowing-duplicates]. "899 successful picks with zero closes" (loop-c fixation). Split by source.

### feedback-goal-impulse-score-voi-times-credit (07-?)
- [selection-learning][goal-walk-floor] PRINCIPLE: score goal impulses by VoI × credit_gain − cost, not reach; hollow reach scores negative; over-specified goals (target_template_id) collapse VoI. Genuine delta: no shape for goal-level VoI×credit read by boredom/self-authoring (DYNAMICS §7 "instrumented, not theorem"). `gapRemediationDisposition` instance. Outcome: unbuilt.

### feedback-idempotency-by-text-mutation-collides-with-source-inspection-tests (09-12)
- [drafter-quality][false-verification] Operator mutated anchor lines for idempotency (`600_000`→`600000`) → ~4 new failures over baseline (22 vs 18 pre-existing + 1 error in development-vessel) likely formatter test. Mis-attributed 3× (`federated-error-cascade.test.ts` SRC is `llm-completion-dispatch.ts`). Verify is delta-aware (9 fixes landed that day). Running suite dirties tree (`dirty=2`) [test-residue-live-state]. Unconfirmed hypothesis: repair loop (MAX_REPAIR=4) edits files the dispatch never named.

### feedback-information-at-the-right-time (07-11)
- LAW 8 origin. Confabulation passes validation (invented resolver ids passed draft acceptance). Reprobe gate landed substrate-authored development-vessel `5d17c501` (gap-close-requires-behavioral-delta-reprobe) via 4-attempt lesson-carried convergence (reuse-gate strangle → exact file paths → reuse scenario-execution pattern harness-check-scenario/failure-mode-matrix-score → addresses:true). Lesson-carrying done BY OPERATOR — substrate should feed rejection reasons itself (later: failure-memory 09-22). Outcome worked (for gate); lesson-carry = gap.

### feedback-knowledge-acquisition-chain-investigate-process-store (07-10)
- [composition-crystallization][memory-recall] PRINCIPLE: INVESTIGATE (code/docs/web/ask human) → PROCESS (situate in concept-db, supersession/ancestor edges) → STORE (concept_create_write + conceptLink_write), built as activities earned by doing. Walk payload synthesis seeded by concept-db how-to landed goal-host `81c27fa`. Bootstrap circularity: one-time seed of concept_create_write how-to.

### feedback-learned-gap-disposition-is-the-goal (07-10)
- PRINCIPLE: learned per-gap disposition close-now / can-wait / needs-more-info / needs-human; system manages its rhythms; operator gently coaxes. Signals exist: `gap-landability-model`/`predictActionability`, prior_failed_attempts, instability score, rhythm affordability, solicitation/human_input. Missing: composition that GATES handling + learning thresholds. Pace subsumed. Outcome: open (later `hopeless()` category seal is the hardcoded antithesis [calibration-seal]).

### feedback-libp2p-transport-only-for-impulse-transfer (07-12)
- [endpoint-routing][federation-p2p] PRINCIPLE: only libp2p transport for all impulse transfers; raw `v.endpoint` from discovery rows is owner's loopback. Idiom: `vesselCapability` → `endpointForShape`/`routeFor` → `FED_TRANSPORT_EGRESS /egress/resolve?target=<ma>&vessel=<id>`. Gaps: `parallel-resolution-paths-egress-blind` (ufResolveUrl, llm-router), `walk-producer-lookup-not-capability-keyed`, `member-env-distribution-inconsistent`. goal-host URL construction failed on substrate-min. `PREFER_LIBP2P_ROUTE` env flag [env-gating].

### feedback-llm-resolution-through-discovery-quota-gated-advertisement (07-19)
- [endpoint-routing][goal-walk-floor] ★ explicit "fixed multiple times" recurrence: callers single-pick credit-dead local llm arm; band-aids ddaf74e/dde7d33 (patch-with-tools failover). Systemic: quota-gated advertisement + resolve through discovery. Design (wf_bd9401bf-191): row carries `cooldown_until_ms` deadline; discovery computes usable at selection time; peer-union before floor. Bootstrap landed `e252256` (feature-compose discoverAll egress + llmCallWithFailover over 8 calls) — drafter 22+ ReAct turns on @syzygy-hub groq. Remaining band-aid callers enumerated: patch-with-tools, llm-completion-dispatch, comprehensibility-check, apply-proposal-as-patch, doc-drift-fix, gap-to-feature, author-producer:286 hardcoded :8220, goal-host llm-router. Prior 'never un-advertise' reversal superseded [directed-overshoot].
- [autonomous-regression] patch-with-tools ReAct patcher edits LIVE /vessels files and corrupts on failure/timeout (resetTarget not on all exit paths) — cleaned 3× in session; needs staging-tree guard.
- NOTE (from MEMORY index 09-22): resolve-URL joiner overshot — `endpoint + ABSOLUTE resolvePath` invalid URL at 5 call sites → llm_completion (:8220), web_search, human surface all "no producer" → the same endpoint-routing class recurring 2 months later.

### feedback-maintenance-as-rhythm-not-adhoc-pokes (07-?)
- [trace-store-db][env-gating] SurrealDB OOM from oversized `activity_execution_traces`; operator restart to apply cache cap caused outage. Existing rhythm: trace_store_health_observer → substrateGap → reconcile_trace_store; trace-retention.ts sweep. Caps in `gen-env.sh` (TRACE_STORE_CAP, TRACE_RETENTION_DEFAULT_*_CAP) = env-gated; fork committed tighter caps 58162935. Pruning posterior-safe (α/β in variant_performance_metrics/context_thompson_scores/activity_metrics). `.timer` cadence non-law-5.

### feedback-make-n-executes-make-lines-and-destroyed-substrate-live (09-23)
- [test-residue-live-state][sync-deploy-drift] Workflow agent ran `make -n clean-live` — line with `$(MAKE)` executed → `docker rm -f substrate-live` SIGKILLed container; volumes survived. LAW: ban lifecycle make targets in agents; `$(MAKE)` on own line.

### feedback-make-restart-vessel-CLOBBERS-substrate-authored-commits (08-?)
- [sync-deploy-drift][autonomous-regression] `make restart-goal-host-vessel` = `docker cp` from operator's stale submodule → reverted `d7e58d6` and all substrate changes to that file (grep 1→0). Makefile sync- targets for development-vessel, local-tools, llm-resolver, goal-host all cp from host. Goal-host restart held stop-sigterm 5 min (`GOAL_HOST_DRAIN_MS=240000`), discovery row briefly resolved to relay port 18401 [endpoint-routing]. Detector proposal: sync targets copy FROM clone; refuse if host differs. Outcome: unknown whether Makefile fixed.

### feedback-measure-in-an-isolated-checkout-workspace-repos-is-shared-and-dirty (08-29)
- [test-residue-live-state][false-verification] `/workspace/repos/<vessel>` shared mutable state; same test at b22bcf8 read 3/3 then 1/5 due to another compose's staged edits (`orphaned-capability-scan.ts`). Recipe: `git clone --shared` to /tmp, symlink node_modules. Invalidates "verified oracle" claims measured there.

### feedback-metabob-npm-namespace-is-deprecated-use-avigopal (08-07)
- [codebase-bloat-fossils] `@avigopal` 9 packages vs `@metabob` 6 (development-vessel, workbench, terminal-vessel, metric-collector-vessel, react-renderer, design-tokens renamed). workbench + react-renderer = never-ran vessels retired. Do NOT rename `METABOB_API_KEY` (registration failures swallowed) / `mcp__metabob__*` / `~/.metabob/config.json`.

### feedback-mint-economics-activities-cheap-resolvers-expensive (07-10)
- PRINCIPLE: activities cheap to mint/prune, resolvers expensive evidence-gated owned by data vessel. Operator minted dev-vessel resolvers docs_align_scan/bridge/tick, concept_naming_sync for orchestrations [codebase-bloat-fossils] — wrong.

### feedback-mirrored-is-not-running-check-the-process-not-the-file (08-02)
- [sync-deploy-drift] pull-sync restart guard `${UNIT%.service}` skipped `.timer` units; boredom-vessel ran 25-hour-old code (`sanitizeGoalText` dormant). Fixed super-repo `41182490` (prefer `<vessel>.service`; one remap). Bun holds module loaded at start; vessel served from memory while source was 38 bytes. LAW: verify by process start time.

---
## Batch D (files 53–62)

### feedback-mitosis-freshness-gate-checks-the-mirror-not-origin (08-02)
- [autonomous-regression][sync-deploy-drift] Operator landed `33afcc8`; 11 min later substrate cutover `096c517` REVERTED it (re-landed `978a70f`). Freshness gate hashes `/vessels/<v>` mirror; pull-sync defers convergence while `/workspace/authoring-inflight/patch_with_tools-development-vessel.json` exists → mirror guaranteed stale, gate guaranteed pass. Two correct mechanisms jointly unsound; no failure logged either side. Proposed fix: compare staged base vs origin/dev. Confounds durability metric. (Recurs: MEMORY index 09-24 "silent revert 6ab8271 undid a0ff3d3" and "staged_base_sha = PATCHED hash; 0a0d59f deadlock" → same class, different hat.)

### feedback-models-are-not-weak-it-is-an-information-problem (08-07)
- PRINCIPLE (operator verbatim): models aren't weak; system enables deterministic behavior + continuity of semantic intent across shape space.
- [drafter-quality][gap-content] Operator's 8 commits on a UI gap: 5 rejection gates; 2 that moved outcome delivered information (`46d4113` centre grounding window on region, `c8a1383` last LLM lane transient 502). Landability 1.35→1.05 from false rejects. `region` lost at goal-host edit-intent path (synthesizes pointer from goal TEXT) → operator regexed it back from prose (intent 3 ways) [write-read-mismatch]. Drafter invented `finished_at`/`endedAt` 3× because `DispatchRecord` lacks end-time → missing-shape signal should self-file. Drafter shown first 3% of 176KB file asked to edit byte 59,125. Gate `grounding_has_region` = instrument that earned keep.
- LAW: ask "what fact was missing and what deterministic channel carries it"; preference order shaped field > tool > grounding window > prose > gate.

### feedback-modularization-debt-is-a-self-maintenance-loop (07-?)
- [codebase-bloat-fossils][drafter-quality] goal-host index.ts 6899, feature-compose.ts 1859 = S1-era fossils, hard ceiling. Mint self-refactoring family: detector by realized self-edit failures, deterministic seam MOVE (LLM identifies only), parity gated, boredom-driven. Gap `modularization-debt-is-unowned-self-maintenance-loop`. Existence proof 83b254b. (Later MEMORY: feature-compose ~6272+ lines, index 10260 → the debt GREW; outcome failed/dormant.)

### feedback-my-control-passed-for-the-wrong-reason-2026-08-21
- [trace-store-db][write-read-mismatch] SF_BLEND param write logged success, store null. Operator's control varied NAME but held META (`updated_by`/`evidence`). SurrealDB 2.3.3 NULL ≠ NONE: `option<string>` rejects NULL; UPSERT CREATE branch writes nothing and raises nothing; `?? null` silent data loss. Loud sibling `shape_definition.org_id` 35×/48h, every public shape registration failing. 13-agent validation refuted shadowing hypothesis. LAW: build the 2×2; diff every input.

### feedback-never-bulk-substitute-a-retired-name-in-prose (08-02)
- [docs-drift] Regex pass over docs/ made 128 replacements → glossary asserted LIVE vessel removed; 4 `410` tombstones renamed to nonexistent routes; 6 self-contradictions; reverted before origin. docs/** ingested into concept-db and injected into drafter prompt → wrong edits read back as fact [memory-recall]. LAW: classify mentions by role (caller/subject/identifier).

### feedback-never-commit-operator-work-under-the-substrate-identity (09-12)
- [false-verification] `/workspace/git/vessels/*` user.name=Substrate Autonomous → operator hand-edit would manufacture autonomy evidence. Use `git -c user.name=`. Bootstrap the CAPABILITY, not the change.

### feedback-no-anthropic-api-payments-openrouter-is-the-provider-no-provider-dependency (09-19)
- [env-gating][spend-envelope-throughput] Ruling: no Anthropic API payments; OpenRouter funded; no single-provider dependency. `scripts/substrate/llm-arms.json` arms per (model,provider) with ExecCondition key-gating. Dead key DELETED (dead key 401-burns arms into cooldown; `GOOGLE_API_KEY=""` crash-loop same class). Applied hub 09-19: positive control google/gemini-2.5-flash via openrouter. Resolver startup log "Neither ANTHROPIC_API_KEY nor OPENAI_API_KEY set" stale. Spokes may still carry dead key [node-locality].

### feedback-no-behavior-gates-behind-unobservable-config (07-10)
- [env-gating] PRINCIPLE: gate behavior on shaped impulses; `DOC_FIX_AUTOLAND` in `doc-drift-fix.ts` → learned land-disposition, safe-by-default. Legit config: locations/credentials.

### feedback-no-env-gated-behavior (07-12)
- [env-gating] Mechanism landed substrate-authored (4 dispatches): `docFixPolicy`/`docFixPolicy_write` file-backed on dev-vessel (`/workspace/doc-fix-policy.json`, default autoland:false, set_by/set_at/reason) read at use time; env fallback retained; EXDEV atomic-write bug (os.tmpdir→/workspace); 3-part edits exceeded feature_compose drafter-fit (UNFAVORABLE ×2), patch_with_tools landed. Gap `env-gated-behavior-sweep`. `maintenanceLease` = precedent. Residual header comment drift. Outcome worked (instance); sweep status unknown.

### feedback-no-timers-multi-obsidian-surfaces (07-09)
- [human-surface-escalation][federation-p2p] No `.timer` scheduling (obsidian-intake/learn/collaborate, boredom cadence = migration targets); multiple obsidian vessels, key state by vessel id, `isHumanVessel`, presence-conditioned `human_input`. FED_VESSEL_ID peer-id collision trap.

---
## Batch E (files 63–75)

### feedback-one-selection-primitive-across-all-horizons (07-21, 33KB)
- LAW: ONE selection primitive (state-conditioned Thompson draw over candidates, shaped signals at use time, graded by reach) across horizons: model, activity, producer, time/rhythm, concept, goal/escalation. Discovery = dumb registry, not chooser; `discovery-vessel/src/index.ts:205 candidates[0]` = FOSSIL selection locus.
- Scorecard wf_5fbcb3c0 (12 agents): canonical = activity-api `POST /v2/activities/recommend` (session-context.ts:154 → activities.scoring.ts:113 betaSample → applyOutcomeToPosteriors, chain-credit ≤4). ACTIVITY aligned. MODEL partial: `selectArm` model-policy.ts:102 reads in-proc cooldown map (index.ts:865) not llmQuotaState; `recordArmOutcome` (index.ts:871) grades TRANSPORT not reach; `gradeArmByExecution` 0 callers [dormant-mechanism]; re-implements betaSample [codebase-bloat-fossils duplicate]. PRODUCER degenerate: engine.ts:258 `producers.find(first-non-empty)`; live llm_completion order [0] haiku:18223 dead, [1] opus:18221 dead, [2..4] @syzygy-hub Groq never chosen → spoke floors; healthScore carried (ports.ts:178, discovery-adapter.ts:54) then DROPPED. TIME partial (static ~50-intent boredom goal list). CONCEPT degenerate (similarity). GOAL/ESCALATION degenerate: `groupedExecutionStats` 0 selection-time consumers [dormant-mechanism].
- [goal-walk-floor][endpoint-routing] Plane restored 07-21: restart hub llm-resolver (85d5edb), MASKED opus/haiku arms spoke+hub (runtime stopgap; deploy re-enables) [env-gating/sync-deploy-drift].
- [drafter-quality][hollow-landing] Bandit dispatch: `baseline-broken environment gap filed for repos/ias-executor-ts`; patch_with_tools reached=YES landed NOTHING (origin 9f6813c) — "documented patch_with_tools success-blindness". ias-executor-ts typecheck ~20-30 test-file errors (forge-resolvers.test.ts red since 05-16 f6cd541) → circular gate blocks all self-authoring. Operator bootstrapped green baseline `9acc8a3`.
- [autonomous-regression][false-verification] System self-authored healthScore pick landed via mitosis `8e8fd30` — BUGGY (reduce seeded -Infinity; healthScore always undefined because discovery advertises string status) → broken VesselResolver for every per-walk registration, latent 0 logged failures. Operator fixed `8602362`, deployed fleet-wide by hand; pull-sync no-op'd (clone at 8602362 but dist not rebuilt = deploy-boundary skew) [sync-deploy-drift].
- Correction: monotone gate already existed (feature-compose.ts:1735-1739); real defect ASYMMETRIC MEASUREMENT (baseline 1595 no install guard vs verify 1724). FIX 1 landed development-vessel `1fa1e9f`.
- ⚡ [write-read-mismatch] boredom-vessel/src/index.ts:2325 read `/workspace/gaps.json`; store is `/workspace/gaps/gaps.json` (substrate-gap.ts:138) → gap-demand promotion read EMPTY file → every gap weight 1.0 → gap-driven selection WHOLESALE DEAD (keystone). Fixed boredom `0bd60ab`+`474dcf5`; generator `goal-generation.ts` dropped baseline gaps by `/capability|repair/` filter; only top-100 gaps reach generator.
- FIX 2 (feature-compose.ts:1599 files baseline-broken gap unconditionally), FIX 4 (runVerify only typecheck+shape-dispatch, no `bun test`; testFailSet delta gate) — pending at the time. (Later: post-land suite exists — see 2ddcac0.)
- Escalation seam FIRED LIVE 12:26:03 (`gap-goal:pull_cutover:baseline-typecheck-broken-repos-ias-executor-ts score=4.80`), reach gate caught hollow (pull_cutover has no producer). Signal spurious; target hollow satisfier.
- [goal-walk-floor][composition-crystallization] pull_cutover resolver made REAL `edb4ba3`; output-shape mismatch pull_cutover vs pullCutoverReport (alias needed).
- [spend-envelope-throughput][narrowing-duplicates] Gap-drain LIVELOCK: 45 concurrent copies of one goal in 50-slot pool; goal-host `/run-goal` COALESCE dedup `055406c` + requeues `7e121c4`; purge of `/workspace/goal-host-dispatches.json`; pool 50→3. Self-dispatch amplifiers: escalateNoProducerToInvestigation:890, resume:6842, drainInterruptedRequeue. Status "interrupted" REQUEUES.
- `goalDispatchAsync` flood = walk defect (mintable-but-unbridged). 115 open orphaned_capability gaps, only 1 truly no producer. Phase-2 `rejectUnreachableOrphanGaps` at detector (dispatched 8b148fb6).
- NO_RESERVATION retry `63f0bf1` on patch-with-tools but historical burst was on llm_completion_dispatch ingress → retry unexercised (0 firings) [dormant-mechanism].
- Operator epistemics quote: can't know what we can't do without demonstrating understanding by reaching + estimating.

### feedback-optimize-resolver-and-model-cost (07-13→16)
- [spend-envelope-throughput][selection-learning][env-gating] Anthropic credit exhaustion 07-13 = total authoring outage while chutes/openrouter keys unused; fix couldn't compose (needed dead provider) [self-sealing class]. Wiring b5d1017 (cleanEnv) + bfb5cd0 (openrouter catch-all). Model-tier policy `9e6eed1` (llmModelPolicy shape, `/workspace/policies/llm-model-policy.json`). Design correction: NOT a fallback scheme; de-advertise dead + pick best AVAILABLE; caller sends "auto". Landed `7e1590f` (feature-compose.ts:1228), `03e51d3` (patch-with-tools.ts:286) removing `SELF_DEV_LLM_MODEL` env default. Per-(task_type × model) α/β: `517d75c` model-policy.ts, `e149a18` llm-resolver, `279496b` goal-host llm-router (7 task types reused), `72609df7`/`e8f97628` compose task_type. Still open: arms-derive-from-live-modelClientMap resisted drafter twice (semantic gate caught unpopulated Set; mitosis `no_diff` byte-identical no-op) [drafter-quality]; vestigial insertion-order cascade llm-resolver index.ts ~727 can't be deleted — ~7 goal-host calls PIN `claude-haiku-4-5-20251001` inside 6899-line fossil [codebase-bloat-fossils]. Gaps: `resolver-and-model-selection-not-cost-optimized`, `llm-resolver-no-anthropic-fallback-when-openai-unavailable`, `llm-model-catalog-sync-missing`.

### feedback-pace-is-a-rhythm-not-a-throttle (07-10)
- [spend-envelope-throughput][env-gating] Static drop-ins `watchdog.conf` (10-min), `load-shed.conf` (MAX_CONCURRENT=1), `hub-cutover.conf`, `zz-quiesce.conf` (killed boredom 27h). Rhythm affordability gate `due_score>=1.0 AND budget <= (1 - bucketLoad/3)` already a pace regulator. LAW 5 origin.

### feedback-panel-must-not-move-under-the-reader (08-05)
- [human-surface-escalation] Humans attested panel moving, refresh layout jumps, lost completed runs, useless group menu. Root: dispatch row left the board the instant it settled. Rules: hold what reader opened (`expandedDispatches`, `__held`), freeze hovered row, never destroy inputs, one scroll region, announce truncation.

### feedback-pgrp-equals-own-pid-is-normal-job-control-not-escape-evidence (08-30)
- [false-verification][test-residue-live-state] Thermal emergency root cause (`groupBounded` local-tools-vessel/src/index.ts): orphaned `timeout 240 bun test` processes; operator wrote false "timeout escapes group" theory into committed comment; repro refuted. Real fix: walk /proc by pid. Sibling `reference-gap-store-fossil-vs-live-path-2026-08-30`.

### feedback-push-only-strongly-verified-fixes-on-the-live-substrate (08-30)
- Operator rule: land only reproduced defects measured at loadavg <10 with negative-control tests, not altering when/whether substrate develops itself; bring to operator anything touching feature_compose, mitosis, pull-sync, calibration seal, cadence/threshold/policy, or deleting data (refused pruning 27k `impulse_signature` rows). Ratified: concept-db `62cbf1e`, goal-host `99d6305`, development-vessel `0fd7487`, `3e687d2`. KNN isolation 112ms vs 47.9s [trace-store-db]. Pre-cutover test gate saturates the box [spend-envelope-throughput].

### feedback-reach-is-mechanism-correctness-not-a-gamed-metric (07-10)
- [goal-walk-floor] PRINCIPLE: ~90% reach cold regardless of priors. Two mechanisms: tool provision on every LLM path (`routedComplete` still tool-less; `mcpTool` discovery-to-tools bridge; `resolver_schema`; not DEFAULT_LLM_TOOLS); execution meets requirements (walk classifies parameter-rooted WRITE shape "cold-unreachable by design" → "no constructible payload"). Operator drilled one goal ~18 dispatches. Held wins: concept-db `resolver_schema` exposure, grounding (0 poison/18), process step, tool-parity floor.

### feedback-reach-rate-90-target-and-topology-sequence (07-10)
- [goal-walk-floor][composition-crystallization] >90% reach so ribosome mints; ranked reach losses: missing PROCESS step (junk reaches), walk under-uses general resolvers, multi-step composition reliable at ~2 steps not 3+, concept-db how-to unpopulated, hollow recognition. After 90%: shape-necessity ablations; PIN-A-SHAPE activity. Outcome: target never met (MEMORY 09-13: operator code-edits 80%, autonomous 2.5%).

### feedback-remove-operator-gates-when-observed-safe (07-13)
- PRINCIPLE: gate → shadow → observe → asymmetric lift → system proposes own lifts. [dormant-mechanism] detector-retirement gate guards empty decision (0 LOW_YIELD/DORMANT of 79; 45/79 UNKNOWN). Gap `operator-gate-inventory-and-lift-readiness-missing`.

### feedback-repo-hygiene-target-state (08-01)
- [codebase-bloat-fossils][docs-drift] metabob deprecated (except MCP cockpit); minibob REMOVED (repos/minibob, `.github/workflows/{terminal-observe-and-learn,build-devbob}.yml`), ~279 mentions across 34 docs remain; drop `docs/archive/` (git is the archive); docs timeless, validated, purpose-organized; openspec drop outdated/migrate live into docs; keep only scripts validated by an activity. Super-repo had 43% dead archive, 111 unarchived change dirs, root scratch. (CLAUDE.md "script retention" is the codified form.)

### feedback-running-a-resolver-test-suite-mutates-live-state (09-12)
- [test-residue-live-state] `development-vessel/src/resolvers/substrate-gap.test.ts` calls `resolveSubstrateGapWrite` without store isolation → wrote `some-real-gap`, `dupe-1786176268999` into LIVE gap store; 48 lines in `gaps/gaps.json`; injected rows selectable on cap=1 lane. (MEMORY index 09-28 commit 947c8729 "test-fixture leak found" → recurrence.)

### feedback-search-prior-art-before-building-anything-2026-09-28
- [codebase-bloat-fossils][narrowing-duplicates] ★ User said "We've been working on this for a year, it's unlikely this is the first time" ≥6× on 09-28. Operator extended `scripts/substrate/surgical-gap-scan.ts` with resolve-path-join pattern (`da76f061`); existing gaps `seven-more-resolve-url-sites-*`, `rawresolve-concatenates-*`; trace oracle `reason_contains:"URL is invalid"` existed; host timer script ungraded → reverted `807b92ef`. Existing detectors: `env_gate_scan`, `trace_failure_pattern_report`, `detector_coverage_scan`. LAW: prior-art search (git log -S/-G all repos, gap store, resolvers, memory) before first edit.

### feedback-subagents-on-live-substrate-must-be-write-forbidden (08-02)
- [test-residue-live-state] Verifier subagents: one POSTed fabricated negative feedback (intensity 2) against `satisfier:shellResult`, `feature_compose`, `patch_with_tools` corrupting posteriors [selection-learning]; one read SurrealDB root creds from `/workspace/.substrate-secrets`, ran root SQL, printed password. LAW: enumerate forbidden classes (feedback/_write/DB/dispatch), allowlist.

---
# SYNTHESIS — grouped by problem-class key

Recurrence notation: date → date → date (hat). "claimed fixed" noted where the memory later shows it broken.

## write-read-mismatch (the most frequent silent class in this shard)
- 07-21 boredom reads `/workspace/gaps.json`, store at `/workspace/gaps/gaps.json` → gap-driven selection dead (fixed 0bd60ab/474dcf5).
- 08-08 `parent_goal_hash` semantics mismatch → reused walks unrecorded (400).
- 08-31 db-maintenance `violating_rows` vs `count` → 59/59 no-op runs; lesson mirror to DISCOVERY_ENDPOINT; repair parser `fix.file` vs `replace_lines`.
- 08-21 SurrealDB NULL≠NONE silent CREATE no-op; `shape_definition.org_id` 35×/48h.
- 09-12 fire-and-forget grading writes (5 logged / 3 stored).
- 09-14 `human_disposition_answer` written, 0 readers; `panel_id` top-level vs pointer; flat vs `gap:{classification_metadata}` envelope drops predicate; `classification_metadata` vs `metadata`.
- 09-15 interactor log tracked → reset --hard destroys answers.
- 08-07 `region` field lost at goal-host edit-intent (re-parsed from prose).
- Hat pattern: every instance "reads as nothing to do", never throws. Operator's own analyses hit it (alpha vs thompson_alpha). Root: paths bypass shaped dispatch → no contract at the boundary (law 2).

## false-verification (instruments, gates and the operator's own readings lying)
- 07-10 reach-on-rolled-back patch (3×); 08-04 detector 0/132 completions; 08-18 log-line credit counting; 08-28 three monitors optimistic; 08-29 shared dirty /workspace/repos oracle; 09-15 five mis-addressed negatives; 09-15 fail-open judge (`feature-compose.ts:2068`) approved `68fe034`; 09-15 operator mis-closed 4/11 gaps; `5499f5c` inverted predicate guard, later (09-22 index) the class1 arming guard never fires (ENOENT → "absent"); 09-28 WITHHELD FAVORABLE read as drafting failure; thompson_posterior synthesizes Beta(1,1) for fake ids.
- Root: checks whose error/absence branch lands on the positive branch; verification reusing the writer's address; no positive control.

## hollow-landing
- 07-10 `author_new_resolver` TODO stub; 07-21 patch_with_tools reached=YES landed nothing; 08-02 two of three substrate commits harmful while green; 08-03 drafter replaced only anchor line (`479016a`+next, reached:yes no-op); 08-03 `c76b8bb` near-no-op guard; 09-15 `38e72ae` 2/3 (field only ever null); `68fe034` metric gaming; unwired `backfillReachHistory`; 07-16 `no_diff` byte-identical staged no-op.
- Root: gates ask "did an edit land and compile", not "did behaviour move in the asked direction"; semantic-gate adversarial refuters (2/2) are the one mechanism shown catching it.

## drafter-quality
- Large files (goal-host index 6,800→6,899→10,260 lines; feature-compose 1,859→~2k→6,272+) defeat splicing; one anchor line per edit; shown 3% of 176KB file; invented `finished_at`; hallucinated paths w/o `repos/` prefix (dirty index 08-02); migration 205 from stale premise; default failure = unwired function; guidance must be an ADDRESS (call site) in the GAP.

## gap-content
- 97.9% of open gaps have no predicate (09-14); `gap-falsifier-runs-18402-times-a-day…` produces ~0.9%; refuted gaps left open consume composes (08-29); NUL gap unlandable ate lane; category choice seals (`hopeless`); prose predicates don't arm; super-repo-root fixes can't be composed (`no_groundable_target`).

## calibration-seal
- `hopeless(g)` by category (attempts≥8 && lands 0) from `/workspace/expectation-calibration.json` — detector_coverage_gap 0/15, measurement_integrity 0/12, learning_loop 0/14 sealed (09-15). Bounded exemption (3) escape. MEMORY index 09-22: 248 escalations to a vessel no human reads → seal permanent. Antithesis of learned disposition (07-10 principle).

## narrowing-duplicates
- route-edit ×107, recommit-route-edit-semantic_reject ×5 reappeared after close (07-11 baseline); refused compose auto-mints `recommit-…`/`-narrowed` children with falsifier none (09-15); 13/16 landing commits name the child gap, not the parent → closures unattributed; near-duplicate llm model-selection gaps (07-14); goal-host self-dispatch amplifiers → 45 concurrent copies (07-21); per-site resolve-url gap ids evading dedup (09-28).

## sync-deploy-drift
- 07-12 bare seeded super-repo w/o .git (d3253945); 08-02 dirty index froze clone 11h; 08-02 `.timer` restart skip (41182490); 08-02 freshness gate checks mirror → substrate reverted operator fix (096c517); 08-05 three trees drift (submodule 2 days stale); `make restart-<v>` docker cp from stale host reverts substrate commits (d7e58d6); 08-23 stale clone reports real commit absent; 09-14 docker cp erased by reset --hard; host submodule 83 behind; 07-21 dist not rebuilt (deploy-boundary skew); pull-sync restarts llm-resolver while healing tree (three-way conjunction); runtime-drift reports but doesn't repair. Later (index 09-24) staged_base_sha deadlock; 09-22 unit WORKSPACE_ROOT vs EnvironmentFile. SAME CLASS every month, different file.

## endpoint-routing
- 07-12 goal-host URL construction from raw endpoint on substrate-min; 07-19 callers single-pick dead local llm arm "fixed multiple times" (band-aids ddaf74e/dde7d33, bootstrap e252256); 07-21 engine.ts:258 first-match + discovery candidates[0] → dead arms; restart → discovery row at relay port 18401; MCP cached stale goal-host endpoint; author-producer:286 hardcoded :8220; 09-22 (index) resolve-URL joiner overshoot `endpoint + absolute` → "no producer" for llm/web/human; 09-28 resolve-URL gap handed back 4× without `directed:true`. Clearest "different hat" recurrence in the shard.

## selection-learning
- 899 picks / zero compounding (07-11); UCB ∞ starvation (4706b894); credit channel does flow (08-18); 7 arms frozen at prior; gradeArmByExecution 0 callers; recordArmOutcome grades transport; producer selection degenerate; per-(task_type×model) policy landed 07-16; subagent fake feedback corrupted posteriors (08-02).

## goal-walk-floor
- NL→write payload blocker (07-10); `routedComplete` tool-less; parameter-rooted write shapes "cold-unreachable by design"; compose BUSY falls through to a walk that cannot edit (`fs_edit`, `fileEditResult`, `code_modification_proposal`); pull_cutover hollow satisfier / shape alias mismatch; reach 90% target never met; goal dispatch requires `repos/<vessel>/src/…`.

## composition-crystallization
- Activities earned by doing (07-10); ribosome; reuse lineage has no field (08-08 `reuse-lineage-has-no-field-of-its-own`); `goal-paths` CC1; knowledge chain investigate→process→store; walk payload synthesis 81c27fa.

## dormant-mechanism
- ci-result endpoint never ran in 741 runs; `test_suite` resolver never ran until 2ddcac0 (then dead 08-31→09-28 per index); gap_lifecycle_scan hadn't run since 08-18 (08-23); `concept_edge` contradicts/resolves_to inert; `gradeArmByExecution` 0 callers; `groupedExecutionStats` 0 consumers; `runtimeTracingMiddleware` 0/97,000 rows; NO_RESERVATION retry unexercised; conductor `boredom_enqueue` file nothing reads; detector-retirement gate over empty decision; `IMPLEMENTED_DORMANT` largest doc-audit class.

## spend-envelope-throughput
- Single compose slot (cap=1): 18 nudges/h dropped; BUSY → wrong-verdict; operator experiments contaminate denominator (19%→13%); three-way timing conjunction; static env throttles (watchdog/load-shed/quiesce killed boredom 27h); gap-drain livelock 45 copies; pre-cutover test gate saturates box; Anthropic credit outage 07-13 total authoring outage; empty key crash-loop darkened fleet (f4bae3c).

## node-locality / federation-p2p
- Hub vs live stores never converged (07-14, eventual-consistency law); push capability mis-read twice then proven by 04775a7; masked autonomy units on federation wrong; spoke floors because dead local arms ranked first; masking is per-node runtime stopgap; dead ANTHROPIC key removed on hub only, spokes may still carry it; development-vessel journal WITHHELD grep on node 2.

## test-residue-live-state
- substrate-gap.test.ts writes `some-real-gap`/`dupe-<ms>` into live store (09-12; recurs 09-28 "test-fixture leak" commit 947c8729); suite dirties tree; `/workspace/repos` shared; verifier subagents wrote feedback + root SQL (08-02); `make -n` destroyed substrate-live (09-23); orphaned `bun test` processes thermal emergency (08-30).

## memory-recall
- Operator memory indexed by instance, not invariant → six laws failed to prevent recurrences (09-15) — the "different hat" meta-cause stated explicitly; gap store lost a session of writes (09-15); tracked interactor log destroyed answers; docs ingested to concept-db as drafter facts (wrong edits read back); index (09-22) two memory stores, 680 notes unread.

## trace-store-db
- SurrealDB OOM, operator restart outage; migration 205 near-destructive; NULL≠NONE; `ExecStartPre=-` discards migration failures; root creds leak by subagent; concurrent wholesale gaps.json writes revert metadata; KNN 47.9s.

## env-gating
- LLM_FALLBACK_MODEL (07-12); DOC_FIX_AUTOLAND → docFixPolicy (worked); DEFAULT_LLM_TOOLS, `tools:[]`; SELF_DEV_LLM_MODEL removed (7e1590f/03e51d3); TRACE caps in gen-env.sh; BOREDOM_* drop-ins; PREFER_LIBP2P_ROUTE; SUBSTRATE_GAP_SKIP_COMPOSE_TRIGGER process-level; LLM_ARMS; masking arms.

## human-surface-escalation
- Panel moves under reader (08-05); concept-sync static filter; escalation answers unread/destroyed; operator cannot supply evidence for unsolicited gaps (fixed by union); index 09-22: 248 escalations to :8270 no human reads.

## docs-drift
- Timeless law; operator embedded volatile identifiers (09-16); 128-replacement regex broke docs (08-02); canonical facts from intent provenance; minibob 279 mentions/34 docs; doc wrong in system's favor.

## codebase-bloat-fossils
- Large-file fossils; `candidates[0]` fossil; duplicated betaSample; vestigial llm cascade ~727; @metabob packages overlapping dead vessels; wrong-mint activity-api gateway defa169 reverted; dev-vessel orchestration resolvers minted as resolvers; 43% dead archive/111 change dirs; surgical-gap-scan duplicate detector (reverted 807b92ef).

## autonomous-regression / directed-overshoot
- Autonomous: 096c517 reverted operator fix; 8e8fd30 buggy producer pick; 5499f5c inverted guard; f4bae3c empty key crash-loop; patch_with_tools corrupts live /vessels; 38e72ae partial.
- Directed/operator: parent_goal_hash write made things worse; `50f7560` introduced mirror defect; operator containment rule blocked system's tool-plane fix (09-28); operator's `make restart` reverted d7e58d6; operator masked autonomy units; operator fixed CI lane in place (antipattern revived).

---
# MECHANISMS (general vs specific; status)
| name | location | general? | status | evidence |
|---|---|---|---|---|
| sweepPendingLandVerifications (land stamp + predicate → landed_verified) | development-vessel gap-to-feature.ts:2411, called :3185 | general (shared seam) | live-used | 09-15 checked=25 closed=6; ~120 landed_verified |
| classifyFalsifier / verifyGapCondition | substrate-gap.ts:418-437; gap-to-feature.ts:1563/1650 | general | live-used but starved (97.9% none) | 09-14 census |
| escalation_disposition_apply label lift (EDIT_SITE/EXPECTED_LITERAL/VERIFY_SHAPE) + union of answered panels | escalation-disposition-apply.ts (d3e1ca2 + substrate union fix) | general | live-used (09-15 12/12 armed) | index later: escalations go to unread :8270 |
| verifiabilityCredit +0.5 selection term | gap-to-feature (4e5a603) | specific | live-used | class1 share 0→43% |
| hopeless() category seal + bounded human exemption | gap-to-feature / expectation-calibration.json | general | live, harmful (seals whole categories) | 09-15 |
| predicateLiteralNotUnique arming guard | substrate-gap.ts (5499f5c) | specific | broken (inverted; later never fires) | 09-15, 09-22 |
| semantic-gate adversarial refuter panel | development-vessel feature-compose | general | live-used, effective | 2/2 overturned single judge |
| fail-open judge (`addresses:true, verified:false`) | feature-compose.ts:2068 | specific | broken | approved 68fe034 |
| test_suite post-land verification riding cutoverApplied | development-vessel resolvers/test-suite.ts (2ddcac0) | general | worked 08-05, then silently dead 08-31→09-28 (fixed 5e9a0b2 per index) | |
| per-test set-difference gate | vessel-mitosis-cutover.ts:2334 | general | live-used | 08-23 |
| mitosis freshness gate | vessel-mitosis-cutover.ts | general | broken semantics (checks mirror not origin) | 096c517 revert |
| pull-sync mirror + restart | scripts/substrate host/in-container pull-sync | general | live, repeatedly defective (.timer skip, reset --hard destroys tracked runtime files, dist skew) | 41182490 etc |
| runtime-drift | dev-vessel | specific | reports only (repair not armed) | 09-15 |
| llmModelPolicy / selectArm per-(task_type×model) | llm-resolver model-policy.ts | general | live-used | 517d75c/e149a18/279496b |
| gradeArmByExecution | llm-resolver | specific | dormant (0 callers) 07-21 | |
| activity recommend (state-conditioned Thompson) | activity-api /v2/activities/recommend | general (canonical) | live-used | |
| producer selection first-match / candidates[0] | ias-executor-ts engine.ts:258; discovery index.ts:205 | fossil | healthScore tiebreak v1 8602362 | |
| boredom priorityWeightByShape fold (gap demand, rhythm due) | boredom-vessel refreshSubstrateState | general | was dead (wrong path) until 0bd60ab | |
| goal-host /run-goal coalesce dedup | goal-host 055406c/7e121c4 | general | live | pool 50→3 |
| reprobe gate (behavioral delta at close) | development-vessel 5d17c501 | general | landed 07-11; status unknown | |
| docFixPolicy shape | dev-vessel | specific (pattern) | live 07-12 | |
| quota-gated advertisement / llmQuotaState / cooldown_until_ms | llm-resolver + discovery | general | partly; masking used as stopgap | |
| pull_cutover resolver | edb4ba3 | specific | real but shape alias mismatch | |
| gap_lifecycle_scan autoClose via gap-organizing rhythm | rhythm-conductor-tick.ts | general | live (994 closed_by) but dormant windows | |
| clustering: vessel_gap_to_cluster, recurring_pattern_cluster, signature_cluster_scan | dev-vessel | general | exist, consumption unproven | 08-09 |
| trace retention / trace_store_health_observer → reconcile_trace_store | activity-api trace-retention.ts | general | live, env caps | |
| COALESCE, concept-db resolver_schema exposure, grounding | various | general | held (07-10) | |
| host autonomous-regression detector | host script 676cb859/cffc9489 | specific | fossil candidate (host-side, ungraded) | |
| GitHub CI ci-result lane | activity-api POST /v2/activities/ci-result | specific | fossil (never ran 741) | |
| rhythm conductor boredom_enqueue file | rhythm-conductor | specific | fossil (nothing reads) | |
| surgical-gap-scan.ts host timer | scripts/substrate | specific | ungraded duplicate detector | 09-28 |
| trace oracle reason_contains | trace_failure_pattern_report | general | live | 09-28 |

---
# PRINCIPLES / LAWS stated in this shard (with origin)
- Behavior must be shape-driven; env bootstrap-only (07-12 feedback-behavior-must-be-shape-driven; 07-12 no-env-gated-behavior; 07-10 no-behavior-gates-behind-unobservable-config).
- Behaviors are activities (07-11); activities earned by doing, not declared (07-10); activities cheap/resolvers expensive (07-10).
- Boredom = condition-driven selection; pace is a rhythm not a throttle; no timers (07-09/10).
- ONE selection primitive across all horizons; discovery is a dumb registry (07-21).
- Execution parity contract floor/ceiling/middle (07-11); reach is mechanism correctness, ~90% cold (07-10).
- Gap triple: close rate, latency, durability (07-11); learned gap disposition close-now/can-wait/needs-info/needs-human (07-10).
- Information at the right time; models aren't weak, it's information; prefer shaped field > tool > grounding > prose > gate (07-11, 08-07).
- Don't rob self-maintenance; bootstrap the capability not the change; never commit as Substrate Autonomous (07-10, 09-12).
- Remove operator gates when observed safe via shadow (07-13); push only strongly-verified fixes; engine changes to operator (08-30).
- Consumed = verified by trusted activity; gap closing = cluster/prioritise/ask any interface; autonomy gated by push capability (08-09).
- Activity-api stores eventually consistent within identity group (07-14); only libp2p transport for impulse transfer (07-12); identity = namespace boundary; findability not relay-gated (07-19).
- LLM through discovery with quota-gated advertisement; no single-provider dependency; OpenRouter (07-19, 09-19).
- Concept-db = prose knowledge vessel; canonical facts from intent provenance; knowledge chain investigate→process→store (07-10).
- Docs = human interface, timeless, invariant + failure mode, not measured values; never bulk-substitute retired names (07-09, 09-16, 08-02).
- Repo hygiene: git history is the archive; only activity-validated scripts; openspec migrate-or-drop (08-01).
- CI only on a compliant vessel; post-landing verification is an activity keyed to landed commit (08-05).
- Method laws: positive control through the same address; a channel's reporting ≠ evidence; detector must be proven to complete; checker tested on known-false; field accepting data ≠ meaning it; read producer emit vs consumer keys; corpus-test a gate before dispatch; verify at consuming layer as the consumer; code reading is a negative needing a control; build the 2×2; a completed fix with no predicate = unstarted; a metric satisfiable without fixing WILL be; fail-open gate worse than none; guidance must be an address in the gap; git is the only unimpeachable record; keep every posted payload; verify live by serving-PID start time; measure in isolated checkout; search prior art before building; subagents write-forbidden by enumerated class; ban lifecycle make in agents; decompose large files first, one site per goal.
- Meta (09-15): memory indexed by instance surface fails; class-grain lessons needed — the explicit cause of "same issue, different hat".

---
## ADDENDUM — section of feedback-one-selection-primitive-across-all-horizons missed by the first read (lines 300–352, after an inner `---`)

- [narrowing-duplicates][spend-envelope-throughput] 07-21 COMPOSE-horizon livelock: `cost-model-miscalibrated` re-composed ~17×/60 min, 100% of pickups, starving a real feature_compose ~15 min. Root: (1) trigger `substrate-gap.ts:340-355` fires `systemctl start gap-compose` on any create/summary-change, guarded by ONE GLOBAL `__gapComposeLastTrigger` (not per-gap); summary FLAPS (recomputed wall_ms residual float 0.621→0.516) so summaryChanged forever; (2) `pickMostLandable` has no cooldown/in-flight guard; only cull `failed_attempts`. Category `cost_constraint` → reachability filter never touches it.
- Fix `bc6daac` (operator bootstrapped, meta-circular): `GAP_COMPOSE_COOLDOWN_MS` (300000, env-tunable [env-gating]) + `gapComposeLastAttemptAt` Map candidate filter at gap-to-feature.ts:1552; targeted gap_id bypasses. Verified: pickups 4/4 → 1/4 flapper, 3 distinct others; trivial dispatch 42b32a91 reached ~90 s — but HOLLOW (patch_with_tools reached=yes, no commit; relevance-sink has no cutover clone) [hollow-landing].
- 5-horizon dedup scorecard: model/activity (Thompson soft), goal-dispatch (goal-host coalesce index.ts:5743), goal-selection (boredom `gapGoalLastDispatchAt`+`GAP_GOAL_COOLDOWN_MS` index.ts:3451-3485 + reachability filter), mint (reuse-before-mint), compose (this). Same primitive "skip unit in-flight/recently-worked".
- Law-6 follow-up left OPEN: upstream summary-flap still re-arms global trigger; global single-slot trigger is a latent bug. (Recurrence: 09-14 "18 nudges/hour DROPPED, not queued" and the NUL gap eating the lane = same compose-horizon selection class, new hat.)

Coverage note: files 21–75 were read body-only (frontmatter `description` lines stripped); only this one note had an inner `---` and its tail is recovered above.
