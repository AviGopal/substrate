# Live activity pool and execution census (shard: live-activities)

Read-only census of the hub (`substrate-live`) SurrealDB `activity-system/learning_loop`, taken 2026-09-28 ~21:00 local (executions to 2026-09-29T04 UTC).
Tables read: `activity` (4,010), `execution` (150,258), `variant_performance_metrics` (6,744, lifetime counters), `context_thompson_scores` (29,192), `thompson_selection_log` (333,035), `goal_execution_paths` (22,237), `activity_composition_graph` (14,958), `trace_store_counters`, `decision_outcome` (57,904).
Node 2 (`compose2-live`) runs no SurrealDB/activity-api (spoke profile): its traces land on the hub.
Family = id prefix. "live" = not retired and not deprecated.

## 0. Headline numbers

| measure | value |
|---|---|
| activity rows | 4,010 (live 2,766; retired/deprecated 1,244) |
| live rows that are `proposed` (never promoted) | 1,463 of 2,766 (53%) |
| live rows never executed ever (no vpm count, not in the 5-day execution table) | **1,340** (48% of live); 1,310 of them created in June/July |
| live rows that ran once but not in the last 30 days | 585 |
| live rows active in the last 30 days | 841 (30% of live) |
| distinct (input,output) shape signatures among live rows | 879; 165 signatures have more than one member, and together they hold **2,052 rows** |
| executed activity_ids with **no** activity row (satisfiers, code paths, auth) | 1,004 ids / 36,421 executions (24%) |
| execution window actually retained | **about 5 days**: `trace_store_counters.cap = 150000` rows; 09-24..09-29 hold 150,147 of 150,258 rows |
| share of the retained window used by housekeeping and telemetry | validator-dispatch 47,732 (32%) + auth_resolve_v1 21,427 (14%) + gap-to-scenario-bridge-tick 17,974 (12%) + slot-binding 9,772 + mitosis-tick 7,874 = **~70%** |
| Thompson selections (7d) | 61,906; **60%** went to arms with alpha+beta <= 4 (2 or fewer observations); 25% went to arms that executed 0 times in 5 days; 24% went to `proposed` arms |

## 1. By problem class

### write-read-mismatch / selection-learning: learning fields on the `activity` row are write-dead
- All 4,010 activity rows have `thompson_alpha=1, thompson_beta=1, ev=0.5, total_executions=0, successful_executions=0, failed_executions=0, learning_track='unclassified'`. Every row has `last_classified_at` 09-26, yet none is classified. 3,993 rows had `updated_at` rewritten at 2026-09-28T08 (a mass touch that changed nothing semantic).
- Real posteriors live elsewhere, in two tables that disagree on field names: `variant_performance_metrics` (thompson_alpha/beta, counters) and `context_thompson_scores` (alpha/beta per context bucket or cluster). This confirms memory note "activity-table posteriors VESTIGIAL" (09-08). It is still unfixed 20 days later: the columns remain, and any reader of `activity.*` gets uniform priors.
- Internal inconsistency inside vpm: `learned-composition-codereadresult-to-concept-write` has total 5,464 and successful 0, but thompson_alpha 9,193 vs beta 8,479 (the posterior reads as ~52% success while the counter says 0%). `validator-dispatch` vpm says 1.1M runs at 40% success; the 5-day execution table says 99.6% success. At least two writers update alpha/beta and counters with different rules (fractional or credit-assigned rewards vs binary counts).
- `create-shape-provider-goal`: 101,633 runs, 0 successes, beta 101,634, last run 07-13. It is a dead arm that was hammered 100k times before anything stopped it, and it is still a live row.

### endpoint-routing: the invalid-URL fix of 09-22 was partial, and the class ran 6 more days (recurrence proven in data)
- Failure reason `fetch() URL is invalid` (plus `Compose sub-activity ... failed: fetch() URL is invalid`) per day: 09-24 1,751 · 09-25 1,562 · 09-26 3,422 · 09-27 2,196 · 09-28 897. About 9,800 failed executions in the window, across 111 activity ids.
- First claimed fix: goal-host `6c98916` (09-22T07:12, substrate-authored, "rawresolve concatenates an absolute resolve endpoint onto the row endpoint"). Failures continued unchanged at 1.5k-3.4k per day.
- Second fix: goal-host `5ca51be` (09-28T13:00, substrate-authored, "resolve-url-walk-path-sites-7457-15128"). After 13:05, 13,717 executions contain only 2 invalid-URL failures.
- Effect on arms: `auto-bridge-problem_detection` was 63/2,348 ok (2.7%) in the window and **63/68 (93%)** after the fix. `auto-bridge-source_code` went from 33/1,295 to 32/38; `auto-bridge-shellResult` is 37/37 after.
- Consequence for learning (**not repaired**): the infrastructure bug was charged to capability arms. `auto-bridge-problem_detection` has alpha 6.9 / beta 36.2 and `auto-bridge-shellResult` 5.2 / 30.6. The whole `compose-auto-bridge-*` family (2,815 runs, 1% ok) and `learned-auto-bridge-*` (947 runs, 4 ok) carry poisoned betas. Nothing re-attributes failures whose reason is an addressing error, so these posteriors now encode a fixed bug. This is the "negative is unattributed until a positive control shares its address" law, with the learning loop itself as the victim.

### trace-store-db / test-residue-live-state: a hard 150k-row cap plus telemetry rows means the learning substrate is 5 days deep
- `trace_store_counters:execution` has cap 150,000 and row_count 149,790. The table holds 09-24 onward (111 older rows). The ribosome, failure memory and any trend reader therefore see at most about 5 days.
- `auth_resolve_v1` writes an `execution` row for every auth check: 21,427 in 5 days (14% of the store), 3.7% "success", org_id `unknown`, tags `telemetry:auth`. vpm lifetime: 561,660 runs, 5,462 ok. `decision_outcome` holds more auth rows (predicted_success ~2.5e-6). An identity telemetry stream is stored as learning traces and evicts goal traces under the cap.
- `validator-dispatch` alone is 32% of retained rows (47,732; lifetime 1.1M). Fixture and probe ids also sit in the store: `falsifier-probe`, `nonexistent-1790223506421`, `ias-executor-ts-canary-test` (108), and in vpm `__conformance_probe_nonexistent__`.
- The hub stamps its own executions `origin_substrate_id='local-dev-spoke'` (147,744 rows). Only 28 rows carry node 2's id (`spoke-cfda39e7`), and 2,508 carry none. Provenance cannot tell the hub from a spoke.

### node-locality / federation-p2p
- Node 2 (`compose2-live`) has no trace store. The units `learning-loop-selftest`, `validator-liveness`, `joint-liveness` and `compose-drift` (services and timers) were in **failed** state on node 2 at census time. Those four checks presume a local trace store or validator the spoke does not run: per-node health checks are wired to hub-only state.
- In 5 days, only 28 execution rows came from node 2, so node-2 work is largely invisible to the hub's learning tables (or node 2 does almost nothing).
- Federation failures in the execution table: `VesselResolver(federation_verification_report): fetch failed` 159, `Resolver 'federation_verification_report' is not registered` 94, `federation_probe` not registered 56, `VesselResolver(federation_probe)` 70. `learned-satisfier-federation-verification-report` is 176/0.

### codebase-bloat-fossils / narrowing-duplicates: the pool is mostly fossils from the June/July mint storms
Created by month: 2026-05 53 · **06 3,018** · **07 775** · 08 33 · 09 131. 94% of the pool predates August.

| family | rows | live never run | used last 5d (ids) | verdict |
|---|---|---|---|---|
| `gap-closing:*` | 1,925 (1,106 retired) | 257 (+240 stale >30d) | 155 | **Fossil factory.** 1,742 rows share one identical skeleton `read_scenario→fetch_traces→analyze→write_report`, output `patch_proposal` (a report, not a fix). 1,841 were minted in June. In the window: 2,110 runs, of which 1,490 (70%) are one row, `gap-closing:pull-sync-unhealthy-activity-api-1784251158497`, re-run about 300 times a day. |
| `<name>-<13-digit ts>` variants | 586 | 545 | 0 | **Pure fossil.** 570 are `proposed`, 40 ever ran, all minted June/July by variant generation. Examples: `LADDERWALK step 18` ×185 (`lw_s17→lw_s18`, demo residue, 1 ever ran); `release-change` ×177 (`cwd,message,paths→commandResult`, 0 ever ran); `Report Top Failures 24h` ×107; `audit_debug_generalize_execution_summary` ×53; `Deadline Note Index Synthesis` ×50; `Obsidian Assist Active Note Delivery` ×59. |
| `compose-*` (organic edge compositions) | 220 (all June) | 98 | 18 | Fossil. 36 runs, 0 ok in 5 days. 86 rows produce `capabilityGapReport` from nothing, 42 produce `concept`, 34 produce `conceptSample`. They are compositions of compositions, e.g. `compose-analyze-source-to-concept-to-compose-auto-bridge-...`. |
| `composed-*` (composed-cap) | 125 | 82 | 8 | Mostly fossil. `composedDeliverable_pulsevitals2...` ×66 with 2 ever run. The live members are one-off operator probe goals (`composed-cap-report-the-total-number-of-execution-tra`…), i.e. crystallized trivial report goals. |
| `learned-*` (general) | 313 | 186 | 57 | Mixed. 35 rows share a signature producing an 8-shape bundle; 33 rows share `activity_failure_report...`. The actually used ones are `learned-activity-learned-feature-compose` (233/148) and `learned-composed-cap-report-...` (248/200). |
| `learned-composition-*` (ribosome) | 148 | 30 | 74 | **Used but low quality.** 3,382 runs, 23% ok. Many chains end in `…-to-shellresult` or `…-to-concept-write` and never succeed (codereadresult→concept-write 5,464/0 lifetime; git-status→git-diff→concept-write 4,365/0; shellresult→memorynote-write→concept-write 803/0; substrategap-to-shellresult-to-substrategap-write 464/0). Good ones: project-thread-scan→memorynote-write 258/239 and memorynote→memorynote-write 141/139. |
| `learned-satisfier-*` | 22 | 4 | 16 | Used. `learned-satisfier-goal-execution` 1,005/609; `-shell-result` 397/8 (invalid URL); `-execution-trace` 211/0; `-federation-verification-report` 176/0; `-substrategap-write` 132/0. |
| `auto-bridge-*` | 81 | 8 | 38 | **Live, general, recently healthy** (see endpoint-routing). New ones are still being minted in September (37 created: attemptLedger, fossilRankReport, llmModelPolicy…). |
| `compose-auto-bridge-*` | 19 | 0 | 18 | Used, but 2,815 runs at 1% ok. Seven rows each ran 316–620 times with 0–17 ok: repeated selection of failing chains. Mostly the invalid-URL bug; `compose-auto-bridge-source_code-to-ribosome-extract` is 620/0. |
| `learned-auto-bridge-*` | 28 | 11 | 8 | Duplicate of `auto-bridge-*` (learned copies of a deterministic bridge). 947 runs, 4 ok. |
| `proposed_pattern_authored_*` | 124 | 16 | 39 | Mostly fossil or failing. `..._recurrent_problem_detection_composition_9ac1eee0` 305/0; `_http_llm_file_chain` 66/0; `_http_llm_json_pipeline` 52/0. 53 live rows produce bare `httpResponse`. |
| `repaired-*` | 46 | 18 | 1 | Fossil except `repaired-http_response_json_extraction-0dab4494` (84/32). 22 rows produce `patch_proposal` from no inputs, 0 ever ran. |
| `development-vessel:*` ticks/meta | 222 | 45 | 120 | **Core, used.** 32,911 runs, 95% ok. Workhorses: gap-to-scenario-bridge-tick 17,974, mitosis-tick 7,874 (89%), dispatch-latest-auto-draft 1,711, self-fact-reconcile 574, cost-expectation-audit 320. Weak: trace-store-reconcile 470/110 plus 3 hand-made variants (`-lease-ttl-120s` 171/23, `-release-before-verify` 166/19, `-swap-timeout-15min`), which are operator experiment residue. `scaffold-mitosis-track` 2,802/0 lifetime. The 177-row `release-change` variant storm is attributed to this vessel. |
| `other/seeded` (plain names) | 135 | 24 | 38 | Core infrastructure: validator-dispatch, slot-binding, ribosome-extract (1,459/1,456 in 5d; lifetime 5,928/4,358). The rest is demo residue: `ladderwalk:*`, `goalhost-multitask-vars-test-1780313768` (still selected 319 times in 7d), `operator-mcp-isomorphism-probe-1785043093183` (748 selections, 0 exec), `understand-source-file-demo`. The seeded `conservation-*` observers/junctions dominate selection (below). |

Duplicate signatures (live): `lw_s17→lw_s18` 185 · `cwd,message,paths→commandResult` 177 · `{error,execution_trace,goal,trace}→patch_proposal` 108 · `{activity_template,error,execution_trace,goal,trace}→patch_proposal` 101 · `{…,source_code,…}→patch_proposal` 98 and 88 · `∅→capabilityGapReport` 86 · `discoverByShapesQuery→composedDeliverable_pulsevitals2…` 66 · `∅→activityExecutionSummary` 63 · `∅→httpResponse` 53 · `goal→tool_output` 51 · `∅→substrateGap` 44 (42 dev-vessel detectors; 41 used, which is legitimate fan-in). In total **about 500 live rows produce `patch_proposal` as report-style gap-closers**. 171 names have more than one live row (1,501 rows).

Retirement is respected: only 2 retired or deprecated rows executed in the window (3 runs). Retire works (memory: retire primitive 19ae84e). It has simply not been applied to the June/July storm.

### selection-learning: Thompson explores cold arms that are not being run
- `thompson_selection_log` holds only `recommend-*` execution ids, with a candidate pool of about 640 (not the 2,766 live rows and not the 1,303 non-proposed rows). In 7 days, 61,906 selections: **37,329 (60%) went to 330 arms with 2 or fewer observations**, 15,118 went to `proposed` rows, and 15,531 went to arms with 0 executions in 5 days.
- The seeded `conservation-*` family and its `learned-conservation-*` twins took about 30k of 62k selections. Examples: `learned-activity-proposed-pattern-authored-http-response-json-extract` 3,738 selections → 31 executions (2 ok); `learned-conservation-audit-posterior-junction` 3,525 → 1; `learned-conservation-residual-trend-observer` 3,276 → 0; `conservation-residual-trend-observer` 2,643 → 45 (5 ok). The recommend call is decoupled from execution: posteriors on these arms barely move (alpha about 2.2, beta 1.0), so they keep winning samples. This is the "arms n=1" pattern: optimism is never paid down because the sampled arm is not executed and graded.
- `learned-conservation-*` vs `conservation-*` are learned copies of seeded observers with the same role: duplicate arms that split selection.
- Selection logging spiked on 09-16/17 (77,957 and 73,453 per day vs a 2-4k baseline), a selection storm.

### goal-walk-floor: tier outcomes (goal_execution_paths)
Lifetime `successful/total` by walk tier (success is not reach):
- fresh_derivation 485/16,165 = **3.0%**
- universal_tool_fallback 989/11,669 = 8.5%
- satisfier 2,246/14,619 = 15.4%
- learned_pathway 860/2,788 = **30.8%**
- feature_compose 0/60
- untagged 2,481/14,879

In the last 7 days, 4,999 paths were touched: fresh_derivation 83 ok of 6,231 runs; learned_pathway 527/901; satisfier 775/7,328; universal fallback 456/9,277.

This shape matches the "ceiling" idea (a learned pathway is 10x fresh derivation), but the floor (fresh, universal fallback) is at 3–8%, far from the ~90% reach contract. `satisfier:goal-host-walk-failed` 441/0 in 5d (1,383 lifetime), with reason "RETRYABLE CAPACITY: … compose lane at capacity (verdict=BUSY)". Edit goals fail on lane capacity, not capability. `satisfier:activity_metrics` 705 path uses with 10 successful paths; `satisfier:activity_template` 636/10.

### composition-crystallization
- `ribosome-extract` runs about 290 times a day, ~100% ok (1,459/1,456). In September, however, it added only 31 `learned-composition-*`, 17 `learned-satisfier-*` and 14 `learned-*` rows. Many of the chains it did mint are chronically failing (above). Nothing grades a minted chain for retirement: 65 live rows have 20 or more runs and 0 successes.
- `activity_composition_graph`: derived 6,955 edges (164k/190k ok), genuine 5,885 (28k/52k), hub 822, scaffold 1,296. `composition_chain` and `composition_node` are **empty** (0 rows): fossil schema. `activity_template` (0), `execution_traces` (0), `goal_execution_path` (0), `execution_pattern` (0), `composite_sequence_patterns` (0), `pattern` (0), `execution_sequences` (0), `activity_metrics` (0) and `routing_trace` (0) are empty duplicate or fossil tables beside live twins (`activity_templates` 2 rows, `activity_execution_traces` 18,135, `goal_execution_paths` 22,237).

### drafter-quality / gap-content (observed through failure reasons)
Top non-URL failure reasons in the window:
- `dev-vessel http_fetch HTTP 500: Unable to connect` 1,740
- `HTTP 503 draining` (development-vessel restarts) 790 + feature_compose 503 62
- `execution_trace HTTP 500` 391
- `goal_execution: goal or target_template_id is required` 381
- `Resolver 'learned-auto-bridge-problem-detection-1r2k9x' is not registered` 305 (a template references a resolver id that is a template name)
- `substrateGap_write missing_required` 298
- `llm_completion_dispatch cascading` 228
- `Task 'produce' requires shape 'filePaths' but no matching impulses` 189
- `fs_edit/fs_read path outside workspace root: /vessels…//workspace…` 161+152 (a path-root mismatch)
- `Resolver 'condition' is not registered` 88
- `UNRESOLVABLE_PLACEHOLDER {{lifecycle.e…}}` 43

Gap-closing ids containing the unrendered template `{{extract_drafter_scenario_json_value_json}}` (6 rows) show placeholder text minted into activity ids.

### sync-deploy-drift
- `HTTP 503 draining` 790+62 failures in 5 days: vessel restarts (mitosis cutover) abort in-flight work.
- `vessel_mitosis_cutover` 589 runs, 391 ok; 60 of the failures are `refusing cutover on protected vessel: discovery-vessel` (a repeated attempt to cut over a protected vessel).
- `gap-closing:pull-sync-unhealthy-activity-api-*` ran 1,490 times in 5 days (95% ok). The "pull-sync unhealthy" gap is re-detected and re-closed about 300 times a day. That is either a durability failure (the gap keeps coming back) or a closer run as a tick.

### human-surface-escalation
- `satisfier:obsidian:note with project list content` 25/0.
- `uiFeedback_write` structuredError 125.
- 16 live gap-closers emit the full `obsidian:*` output set; none ran.

## 2. Mechanisms (keep or fossil)

| mechanism | location | general? | status | evidence |
|---|---|---|---|---|
| Thompson posterior store `variant_performance_metrics` | activity-api DB | general | live-used, but has two writers with divergent rules | alpha/beta vs counters disagree (codereadresult 9,193/8,479 vs 0 ok) |
| Context posteriors `context_thompson_scores` (cluster buckets) | activity-api DB | general | live-used | 29,192 rows, cluster buckets written 09-28 |
| `activity.thompson_*`, `activity.*_executions`, `learning_track`, `ev` | activity table | — | **fossil (write-dead)** | constant across 4,010 rows |
| Activity classifier (`last_classified_at`) | activity-api | general | broken/dormant | touches every row, all remain `unclassified` |
| Recommend-time Thompson selection (`thompson_selection_log`) | activity-api | general | live, mis-coupled | 60% of selections to n≤2 arms; selections not executed |
| Walk tiers (learned_pathway / satisfier / universal_tool_fallback / fresh_derivation / feature_compose) | goal-host | general | live-used | 4,999 paths in 7d |
| Satisfier path (`satisfier:*`, no activity row) | goal-host | general | live-used, invisible to the pool | 179 ids, 9,016 runs, 52% ok; not in the `activity` table, so not selectable, retirable or mergeable as activities (law 2 gap) |
| `universal-tool-fallback` (ReAct floor) | goal-host | general | live-used | 1,918 runs, 318 ok (17%) in 5d |
| `feature_compose` edit lane | development-vessel | general | live-used, low yield | 1,949 runs, 382 ok (20%) in 5d; lifetime 9,614/844 |
| auto-bridge (deterministic shape bridges) | activity-api/goal-host | general, shared seam | live-used, healthy since 09-28T13 | 63/68 post-fix |
| `learned-auto-bridge-*` | pool | specific | duplicate of auto-bridge | 947/4 |
| Ribosome `ribosome-extract` | development-vessel | general | live-used | 1,459/1,456 in 5d; output quality ungraded |
| Organic composition minting (`compose-*`, `compose-auto-bridge-*`) | development-vessel | general | fossil (June) plus chronic failures | 220 June rows; 2,815/33 |
| Gap-closing template factory (`gap-closing:*` 4-task report skeleton) | development-vessel | specific (one skeleton) | **fossil / hollow** | 1,742 identical skeletons; they produce a report, not a fix |
| Variant generator (`-<ts13>`, `_variant_`, `-improved-`, `-hardened-`) | development-vessel | general | fossil (stopped after July) | 586 rows, 545 never ran |
| Retire primitive | activity-api | general | live-used, under-applied | 1,106 gap-closers retired; retired rows are not executed |
| Execution row cap (150k) | activity-api `trace_store_counters` | general | live; window too short because of telemetry | about 5 days retained |
| Auth telemetry into `execution` (`auth_resolve_v1`) | identity-vessel → activity-api | specific | live, polluting | 21,427 rows in 5d |
| `validator-dispatch` | activity-api/validator | general | live-used, dominant volume | 47,732 in 5d (32%) |
| `slot-binding` | goal-host | general | live-used | 9,772 in 5d |
| `development-vessel:gap-to-scenario-bridge-tick` | dev-vessel | general | live-used, high volume | 17,974 in 5d |
| Empty duplicate tables (`composition_chain`, `composition_node`, `activity_template`, `execution_traces`, `goal_execution_path`, `execution_pattern`, `composite_sequence_patterns`, `pattern`, `execution_sequences`, `activity_metrics`, `routing_trace`) | DB schema | — | fossil | 0 rows each, live twins exist |

## 3. What to keep and what to archive (from this shard)

**Keep:**
- validator-dispatch, slot-binding, ribosome-extract
- auto-bridge-* (deterministic)
- development-vessel ticks with ≥80% ok
- satisfier path, universal-tool-fallback, feature_compose
- the ~16 learned-satisfier and learned-composition chains with proven success: project-thread-scan→memorynote-write, memorynote→memorynote-write, learned-satisfier-goal-execution, learned-satisfier-memorynote-write, learned-activity-learned-feature-compose, composition:shellresult-to-memorynote-write (308/308)
- `vpm` and `context_thompson_scores`

**Archive or retire:**
- 1,340 live never-run rows, and the 585 stale rows that ran once
- all `<ts13>` variants
- `compose-*` June compositions
- LADDERWALK and release-change storms
- report-skeleton gap-closers
- the 65 live arms with ≥20 runs and 0 successes (after re-grading any that failed only through the invalid-URL bug)
- probe and test residue ids

**Fix before trusting learning:**
- re-attribute or reset the posteriors poisoned by the invalid-URL bug (09-22..09-28)
- stop auth telemetry writing to `execution`
- raise the effective trace window by moving housekeeping ticks out of the capped table
- couple recommend selection to execution and grading
- drop the write-dead activity columns

## 4. Principles evidenced here
- A fix to one call site of an addressing bug is not a fix to the class. The data shows a 6-day, ~9.8k-failure tail between 6c98916 and 5ca51be.
- An infrastructure failure graded as capability failure poisons the posterior. Learning needs failure-reason attribution before updating beta.
- A capped trace store dominated by telemetry is a learning substrate about 5 days deep.
- A pool that mints without retiring accumulates 48% never-run rows. Minting is cheap only if retirement is automatic.
- A selection that is not executed and graded never pays down its optimism: 60% of Thompson picks went to n≤2 arms.
