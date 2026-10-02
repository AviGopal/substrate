# Shard: concept-db-db (concept-db contents + SurrealDB tables beyond execution/activity)

Collected 2026-09-29 ~03:30–04:40 UTC, read-only, node 1 (`substrate-live`, ns `activity-system`, db `learning_loop`) plus a spot check of node 2 (`compose2-live`).
Verdicts: **CONFIRMED** = I ran the query or read the code path. **PLAUSIBLE** = inferred from the evidence, not directly proven.
Nothing was written. I avoided live `/concepts/search` calls because every search writes `concept_usage` and bumps `times_loaded`, so I read the tables directly instead.

---

## 0. Inventory

### 0.1 Server-level namespaces (test-residue-live-state)
- ROOT holds 4 namespaces: `activity-system` (the live one), `scratch_test` (dbs `idxprobe`, `mig205`, `mig205b`), `'scratch_test'` (the quote characters are part of the name; db `'mig205'`), and `audit-scratch` (18 dbs: `E1 F1 bf023 bisectA-D g045 grouptest1 minimal1 r045 repro-b2 repro-b3 repro-broken sweep1 sweep2 verify023 verify055`).
  These are leftovers from the 09-22 bisection of the .surql gate (migrations 023/045/055) and the migration-205 work. They were never cleaned up and share the live SurrealDB process. CONFIRMED.

### 0.2 `learning_loop`: 100 tables. Row counts (single `count() GROUP ALL` each)
Large: execution_trace_content 509,870 · thompson_selection_log 333,092 · execution 150,094 (trace_store_counters row_count 149,863, cap 150,000) · **impulse 107,865** (counting took 45.6 s) · concept 88,560 · decision_outcome 57,908 · promote_gate_evaluations 35,074 · context_thompson_scores 29,192 · concept_edge 22,365 · goal_execution_paths 22,241 · impulse_relevance_metrics 20,714 · activity_execution_traces 18,135 · impulse_shape_activity_score 16,542 · activity_composition_graph 14,958 · goal_verification_labels 14,100 · refusal_events 9,160 · variant_performance_metrics 6,744 · embedding_prior_weights 5,130 · db_admin_audit 4,820 · signature_cluster_run 4,168 · activity 4,010 · concept_usage 3,401 at first count and 3,641 minutes later (it churns, see 2.4) · execution_exemplar 2,967 · successor_features 2,681 · substrate_observable 2,173 · signature_embedding 2,065 · signature_cluster_assignment 2,018 · trace_digest 1,742 · api_validation_trace 1,420 · init_migrations 225 · llm_router_decisions 162 · key_session 132 · api_key 39 · reach_history 11 · substrate_tuning_param 4 · test_registration 3 · code_modification_proposal 2 · test_report 2 · replication_state 2 (last pulled 2026-07-30 from `local-dev-spoke`, stale) · migrations 2 · vessel_heartbeats 2 (2026-05-28, pod `minibob-1`, fossil) · activity_templates 2.

**38 tables have zero rows** (codebase-bloat-fossils): active_connections activity_metrics activity_state_affinity activity_template circuit_breaker_trace composite_sequence_patterns composition_chain composition_node discovered_state_pattern execution_pattern execution_sequences execution_state_snapshot execution_system_traces execution_traces goal_execution_path impulse_data impulse_resolution_metrics impulse_usage_history llm_resolution_log minibob_instance pattern relevance_feedback routing_trace sensitivity_evidence shape_definition shape_gap_resolution state_feature_importance test_audit_report tool_argument_pattern tool_usage tool_usage_patterns upkeep_stats v_argument_recommendations v_shape_pattern_performance vessel vessel_capabilities vessel_circuit_breaker vessel_health_metrics.
- `composition_chain` (table) is empty. The name lives on only as a *field* on execution records (`activity-api/src/lib/posterior-update.ts:760`, `db/paradigm.ts:362`). The table is a fossil.
- `relevance_feedback` is empty. Its writer, `POST /relevance-feedback` (`activity-api/src/routes/activities.ts:11477`, CREATE at 11589), has **no production caller**; the only callers are in `__tests__/phase10-atomic-alpha-beta.test.ts`. It is a dormant mechanism. CONFIRMED.
- `goal_execution_path` (singular, 0 rows) sits beside `goal_execution_paths` (22,241). `activity_template` (0) sits beside `activity_templates` (2), while the real templates live in `activity` (4,010). These are duplicate or fossil names.

---

## 1. Migration ledgers vs `sql/` (sync-deploy-drift, trace-store-db, autonomous-regression)

Three vessels own .surql files. Each uses a different application mechanism:

| vessel | files | applier | ledger |
|---|---|---|---|
| activity-api | 220 (sql/*.surql + schemas + migrations) | `scripts/init-database.ts` | `init_migrations` (filename UNIQUE) |
| concept-db | 10 in `sql/core` (+ `sql/upkeep/002`) | `scripts/apply-schema.ts`, run from `ExecStartPre=-` in `concept-db.service` | **none**: every statement re-runs on every boot, and "already exists" errors are swallowed |
| identity-vessel | 4 in `sql/migrations` | `src/index.ts:1513`, gated on the env var `SCHEMA_AUTOAPPLY`, with a hardcoded list of 001-003 | none. `SCHEMA_AUTOAPPLY` is unset in the substrate (0 matches in `/etc/substrate/env`). 004 was applied by hand on 2026-07-23 (the file header says so) |

Findings:
1. **`init_migrations`**: 225 rows, 224 distinct. `158-extend-paradigm-exec-view.surql` has **2 rows despite `idx_init_migrations_filename … UNIQUE`**, both from 2026-07-14. The unique index is not being enforced. This is the same class as 196/197 "rebuild-corrupt-…-index" (applied 08-22). CONFIRMED.
2. The ledger names two files that exist nowhere (not in the host repo, the container `/vessels`, or the push clone): `143-prediction-disagreement-failure-mode.surql` (applied 06-02) and `159-backfill-aet-to-execution.surql` (07-14). The current files use the same prefixes for different content (`143-embedding-conditioned-prior-weights`, `159-replication-state`). History got renumbered or deleted, so a fresh boot would never replay those two. CONFIRMED.
3. The container clone has 13 duplicated numeric prefixes: 031 045 055 065 069 110 132 133 134 135 156 180 182. Numbers 207-209 are missing. `203-tuning-param-string-values` was applied on 2026-09-24, three weeks after 204-210. Ordering is lexical, not causal.
4. The host clone `repos/activity-api` is **44 commits behind origin/dev**. It lacks `211-rebuild-goal-paths-expected-shapes-index` and `212-restore-vpet-view`, which the live ledger applied on 09-23 and 09-28 (sync-deploy-drift). The host `repos/concept-db` is 7 behind.
5. A second ledger table, `migrations`, has 2 rows (07-17) and no filename column. It is a fossil and a known false-zero trap.
6. **concept-db has two `007-` files, both substrate-authored on 2026-07-03** (a6483ed/ccc35b6/50f0443/7403259). Each runs `DEFINE FIELD OVERWRITE source_type`, and they conflict:
   - `007-legacy-drift-source-types-and-priority` sets a *closed* 16-value `ASSERT $value INSIDE [...]`.
   - `007-repair-stranded-concept-rows` sets `ASSERT string::len($value) > 0`.
   Lexical order applies "legacy" first and "repair" last, so the live definition is the open one (`ASSERT string::len($value) > 0`, verified via INFO FOR TABLE). The vocabulary lock is undone on every boot, and that directly enables the ~200 free-text `source_type` values below. Both files also carry `UPDATE concept …` statements that re-run on every restart, with no ledger. CONFIRMED (autonomous-regression + gap-content).
7. identity 004 covers users/organizations/organization_members only. Live `api_key` and `key_session` are `SCHEMALESS PERMISSIONS NONE`. That is a scope limit of 004, not drift, but the whole vessel's migration path is env-gated and dead in this deployment (env-gating). CONFIRMED.
8. The historical failure F-35 (migrations/ subdir silently skipped, per the init-database.ts:360 comment) and `205-restore-fields-lost-to-unapplied-migrations` are the same "migration not applied, silently" class recurring.

---

## 2. concept-db contents

### 2.1 Shape and source_type vocabulary (gap-content, codebase-bloat-fossils)
- There are 88,560 concepts: 88,497 in `organizations:substrate` and **76 in org `default`** (a tenant split, see 2.5).
- 76,813 rows (87%) have `source_type='impulse_signature'`, and 39,375 have shape `source_code`. The corpus is dominated by auto-extracted signatures.
- **1,517 distinct shapes, of which 985 are singletons** and 1,323 have ≤3 rows. Examples: `substrate_durable_gap_closure_verified_2026_06_04` (345), `mechanism_health_tick_second_run_evidence_2026_06_04` (199), `scaling_ceiling_synthesis_2026_06_04` (198). Many shapes are dated one-off names.
- About 200 distinct `source_type` values. The memory-consolidation concept alone is spelled 9+ ways (`memoryNote-consolidation`, `memoryNote_consolidation`, `memoryNotes`, `memoryNotes_consolidation`, `memory_consolidation`, `operator-memory-consolidation`, `operatorMemoryNotesConsolidation`, `operator_memoryNote(s)`, `operator_memory_consolidation`). Several source_types are whole goal texts, including a pasted install log. Cause: see 1.6.
- Rows by month: 06: 4,436 · 07: 46,635 · 08: 13,826 · 09: 23,669. Curated (non-signature) inflow in September: extracted 2,007, goal_finding 467, reach_gate_lesson 79, doc_expectation 57, recurring_code_problem 57, compose_lesson 21.
- Counters: Σtimes_loaded = 931,318, Σsucceeded = 25,137, Σfailed = 24,712. `times_loaded` is bumped on *retrieval* (every search hit writes `concept_usage`), not on use. Of 28,729 impulse_signature rows, none has ever been loaded.
- Embeddings: 88,067 have `summary_embedding`; 493 have neither embedding.

### 2.2 compose_lesson corpus (drafter-quality, memory-recall, hollow-landing)
- **45 rows with `source_type='compose_lesson'`** (40 with shape compose_lesson, 5 with shape `unknown`). **Every one has `pointer:{}`. None carries an `edit_site` or any file target**, so the question "does the edit_site target exist" does not apply to this corpus. Lessons are per-failure-class and file-agnostic. (Targeting by `classification_metadata.edit_site` lives on gaps, not in concept-db.)
- Duplicates by class: anchor_not_found ×6, syntax_break ×4, semantic_reject ×3, typecheck_dangling_reference ×3, verify_failed ×2, hollow_write ×2 (identical content 09-15), scope_refused ×2 (09-24 and 09-26, both boilerplate), mis_localized_path ×2.
- **6 rows are boilerplate** "compose failure class X: avoid repeating this failure class" (out_of_mount_target, compose_execution_failure, env_change_window_held, park_stale, scope_refused ×2). They exist because `COMPOSE_LESSON_GUIDANCE` has no entry for those classes, so the mirror writes a lesson with no content. This is hollow teaching.
- There is also one "PROBE do not use" row (08-31) in the corpus.
- Retrieval concentration: semantic_reject 07-04 L=1984, dead_insertion_unwired L=1682, partial_spec_omission L=1518, wrong_location L=1111, anchor_not_found(07-04) L=494. The most specific, measured lessons (09-15 anchor_not_found "LARGEST failure class… 1351 events", inert_predicate, mis_localized_path victim-file, 09-10 partial_land) have **L=0**. The generic July rows win retrieval, and the lessons written later from evidence are never served.
- **The write-back that grades lessons is dead.** `feature-compose.ts:3154-3166` (introduced by substrate-authored mitosis `6f69142`, 2026-09-09) does the following:
  1. It POSTs a *flat* body `{type:"conceptSearch",…}`, whereas the working reader at :3387 sends `{pointer:{…}}`.
  2. It parses the response as an array, where the reader expects `{content:[…]}`.
  3. It then calls `POST ${CONCEPT_DB_ENDPOINT}/usage/<id>/fail`. **That route does not exist.** concept-db mounts `/concepts`, `/mcp`, `/upkeep` and `/v2/impulses`, and the usage route is `/concepts/:id/usage`.
  All errors are swallowed. Result: across all compose_lesson rows, Σtimes_failed = 1 and **Σtimes_succeeded = 0**, against Σtimes_loaded = 7,310. No lesson has ever been graded. CONFIRMED (write-read-mismatch, hollow-landing).
- The mirror (`feature-compose.ts:3288`) writes `concept_create_write` with a *static* content string per class. `createConcept` dedups on exact shape+source_type+content+org (an unindexed full scan of about 88k rows), so a re-mirror returns the existing row and learns nothing new. The hub logged "mirrored class=wrong_location" at 22:32 and 00:18, yet the wrong_location row's updated_at stays at 09-11. The per-incident specifics live only in the gap's `classification_metadata.failure_lessons` and in the local `COMPOSE_LESSONS_PATH` jsonl, which is node-local (see 2.6). CONFIRMED.
- Recall query behaviour: 14 of 29 node-2 lesson recalls in 6 h ran with `class=none`, which returns a fixed 8 rows (the "132 consecutive composes got the same 8" defect the code comment describes).

### 2.3 architecturePrinciple and doc-derived concepts (docs-drift, false-verification)
- There are **719 rows with shape `architecturePrinciple`** (all in org substrate, scope org). By source: architecture_doc 104 (06/07), doc_expectation 611 (07: 524, 08: 60, 09: 27), human_input 2, memo 1, vessel_construction_pattern 1. All 719 summaries are distinct.
- **Claim vs reality.** The comment at `development-vessel/src/resolvers/feature-compose.ts:2546` (dated 2026-08-09) says: "shape=architecturePrinciple … no concept in the store has ever carried it", and on that basis *removed the shape filter* from `consultPrinciples`. But 74 such rows existed from June and 524 more from July. Also, concept-db's search does wire `shape` into SQL (`concept.ts:329` `scalarConditions.push('shape = $shape')`). The zero-hit measurement was the `@@`-is-AND long-query miss (fixed separately in 7df39d2 on 08-10), which was misattributed to the filter. Today `consultPrinciples` sends its 3 longest spec words, unfiltered, over 88k rows (87% signatures) with limit 4, so the principles are reachable only by lexical luck. CONFIRMED (misdiagnosis; the discriminator was removed instead of fixed).
- Two ingesters ran over the same docs: `architecture_doc` (short names like `SUBSTRATE_AS_MDP.md: …`) and `doc_expectation` (full paths). **96 sections are ingested twice.**
- Staleness, checked against the current tree for 1,991 doc_expectation/architecture_doc rows (my first pass mis-pathed bare `CLAUDE.md`; this is corrected):
  - ~1,483 are current.
  - **189 name a heading that no longer exists** in its file. The biggest sources are MEMORY_AS_SUBSTRATE.md (20), specs/activity-level-executor-hooks.md (16), WORKBENCH_CHAIN_UX_DESIGN.md (16), SUBSTRATE.md (11) and SCHEMA_OWNERSHIP.md (11).
  - **58 of 69 CLAUDE.md sections are stale** because CLAUDE.md was rewritten.
  - **~260 name files that no longer exist**: repos minibob, metabob-analysis-api, metabob-internal-dashboard, activity-dashboard, k8s-activity-executor, metabob-proto, metabob-mcp, activity-monitor and metabob-opencode are all absent from `repos/`; docs/PRODUCT_BOUNDARIES.md, docs/guides/TEMPLATE_DISPATCHABLE_RESOLVERS.md, docs/troubleshooting/ANTHROPIC_API_401_ERRORS.md and docs/architecture/CONCURRENT_COMPOSE.md are gone.
  - In total **~507 of 1,991 (25%) doc-derived concepts describe text that no longer exists**. The `concept` table has no retired/superseded field, so they keep competing in recall; 1,202 doc_expectation rows have been loaded. CONFIRMED.

### 2.4 concept_edge and concept_usage (dormant-mechanism, write-read-mismatch)
- concept_edge has 22,365 rows. 21,637 are `related_to` "Auto-discovered relationship". By month: 05: 1,957 · 06: 20,148 · 07: 207 · 08: 51 · 09: 2. **Edge creation effectively stopped after June.**
- **95 of 22,365 edges have ever been traversed.**
- **11,952 of 22,365 (53%) edges dangle**: their from or to concept no longer exists. Positive control: in a 3,000-row sample, 1,410 resolved and 1,590 did not. `deleteConcept` (`concept.ts:1080`) cascades edges correctly, so the concepts were removed by some other bulk path. CONFIRMED.
- 50 edges carry "This is an orphaned capability." (08-31) and 84 are `description_of` "Section of CLAUDE.md", which are now mostly stale.
- concept-db `/health`: `upkeep: {scheduler_running:true, enabled:false}`. The upkeep activities (resolve-island, prune-irrelevant-neighbors, …) are off.
- **concept_usage keeps only the hot window.** All 3,641 rows are from 2026-09-29, the earliest at 02:11 UTC. `activity-api/src/services/trace-retention.ts:666-670` reaps `concept_usage` older than `hotWindowMs`. 3,481 of 3,641 are `mcp_rest_search_*` neutral loads, which are MCP cockpit searches, not drafter use.
- **Hazard (directed-overshoot, PLAUSIBLE):** `concept-db/src/resolvers/decontaminate.ts` (`conceptCreditDecontaminate_write`, 2026-07-03) *recomputes* times_loaded/succeeded/failed and relevance from `concept_usage` for every concept with ≥50 loads. Since the retention reaper arrived, a non-dry run would zero the counters and reset relevance to about 0.5 for up to 500 concepts per run. It defaults to dry_run, and I found no evidence it has run since.

### 2.5 Tenant split
- 76 concepts are in org `default`: compose_lesson 11 (08-12 → 09-26), reach_gate_lesson 16, extracted 25, operator_write_probe 13, and others. `createConcept` dedup is org-scoped, so the same lessons exist in both orgs. Some default-org rows show loads (L up to 11), so at least one reader path (root, unauthenticated) sees them. JWT-scoped readers do not. PLAUSIBLE split of writers by credential (memory-recall).

### 2.6 Node locality (node-locality, endpoint-routing, env-gating)
- Node 2 (`compose2-live`) runs no `surrealdb` and no `concept-db` (`systemctl is-active` → inactive for both). Its running development-vessel has **no `CONCEPT_DB_ENDPOINT` in `/proc/<pid>/environ`**, so the code defaults (`feature-compose.ts:2544`, `config.ts:41`, `resolvers/concept.ts:5`) point to `http://127.0.0.1:8260`, which nothing serves.
- In the last 6 h on node 2:
  - Lesson reads that go through `DISCOVERY_ENDPOINT/resolve` succeeded (29 `source=concept-db n=8`).
  - **26 `[compose-lessons] concept-db mirror failed: Unable to connect`**.
  - **300 `[concept-bridge] usage record failed … Unable to connect`**.
  Reads route by discovery; writes use a hardcoded local endpoint. So every lesson and usage signal produced on node 2 is lost. CONFIRMED (log-observed).
- `consultPrinciples` also uses the local endpoint and returns `""` on error, so drafts composed on node 2 probably get no architectural principles at all. PLAUSIBLE (code-derived, not log-observed).
- `COMPOSE_LESSONS_PATH` (the "MOST RECENT ACTUAL REJECTION per class" block) is a local file, so each node sees only its own rejections.

### 2.7 Search starvation: the recurrence chain (goal-walk-floor, memory-recall)
- concept-db `/health` (process up since 2026-09-28 18:57 UTC): searches 25,636; dense_hits 1,385; dense_budget_misses 44; **dense_true_empty 24,207 (94%)**.
- The dense leg runs only when the lexical ladder returned 0 (`concept.ts:542`), so these are searches where both legs came back empty.
- Hub concept-db log, 6 h: 15,333 "dense leg returned nothing", 4,159 "relaxed the term-set".
- HNSW itself works. Positive control: KNN from an existing lesson vector returns 5 lessons at distance 0.
- Cause of the empties is PLAUSIBLE, not proven. KNN takes the top max(4·limit, 32) neighbours over all 88k rows, *then* filters by org, source_type and shape in the hydrate step (`concept.ts:756-790`). A filtered search for a small corpus (45 lessons, 719 principles) can post-filter to nothing. My own-vector KNN probes returned same-type neighbours, which does not discriminate this for free-text queries.
- Operator commits, each fixing a variant of "search returns nothing / too slow", in order:
  1. 7df39d2 (08-10) `@@` is AND
  2. c9f083e (08-15) bound the dense leg
  3. dee1f90 (08-15) don't start dense until lexical fails
  4. a4e353d (08-16) last rung dropped the subject
  5. 62cbf1e (08-29) scalar filter beside `<|K,EF|>` defeats HNSW
  6. 78311ad (09-02) cache query vectors, "principle consult was timing out"
  7. cb400d6 (09-02) make starvation observable
  8. c404069 (09-02) hydrate by record id (17,000× faster)
  9. fd645bd (09-02) two-stage FTS
  Each fixed a real mechanical defect. None changed the structure: one undifferentiated table where 87% of rows are signatures, AND-lexical search, and post-KNN filtering. 94% empty fallback today.

---

## 3. Oracle / feedback / outcome tables

### 3.1 goal_verification_labels (14,100): false-verification, test-residue-live-state
- By month and labeler: 07: human 993, deterministic 57, automated 16 · 08: deterministic 1,134, automated 462, human 31 · 09: deterministic 11,288, automated 54, human 65.
- **Human (operator) labels ran at about 50/day from 07-02 to 07-29 and about 3/day since.** The oracle corpus is now 80% deterministic.
- **`grounded` is never true**: 12,950 are false and 1,150 are null out of 14,100. It is a hollow field.
- Verdicts: not_achieved 11,028 · achieved 2,965 · partial 107.
- September deterministic labels by top activities: universal-tool-fallback 1,604 (813 achieved/791 not) · satisfier:code_modification_proposal 639 not · memoryNote_write 1,124 · activity_metrics 472 not · shellResult 695.
- By goal prefix: "investigate and decompose gap route-edit…" 1,899 · "db_performance…" 431 · "Close substrate gap orphaned-capability-…" 375 · **"In repos/development-vessel/src/fixtures…" 260**. Those 260 are test-fixture goals labelled in the live oracle corpus (test-residue-live-state).

### 3.2 decision_outcome (57,908): calibration-seal, selection-learning
- Starts 2026-08-24 (migration 201/202): 08: 7,297 · 09: 50,612.
- Since 09-01: success+reached 18,969 · fail+not reached 28,430 · **success but not reached 1,915** (hollow completion) · reached=null 1,298.
- Since 09-15 (n=26,710): mean predicted_success 0.207 vs observed 0.138. The predictor is over-confident by about 50% relative.
- Top activities since 09-15: universal-tool-fallback 6,530 · satisfier:project_thread_scan 4,304 · development-vessel:mitosis-tick 1,986 · satisfier:project_plan 1,982.

### 3.3 refusal_events (9,160): goal-walk-floor
- All `no_producer_for_expected_shapes`, apart from 31 promote_gate_below_threshold in June/July. By month: 06: 178 · 07: 4,865 · 08: 1,010 · 09: 3,076. The latest was at 2026-09-29 03:21.
- Top September expected shapes: `["goal"]` 314, `["activity"]` 180, `["activityExecutionTrace","goal_verification_label_write"]` 126, `["code_modification_proposal","lifecycle:execution:succeeded"]` 99, `["execution_trace","trace"]` 93, `["git_commit","git_push"]` 43, `["fs_edit"]` 39. Target inference is naming lifecycle/event tokens and generic nouns as output shapes. This is the "target inference found no shape" class.

### 3.4 promote_gate_evaluations (35,074): hollow gate, narrowing-duplicates
- Since July **33,731 promote vs 100 refused (99.7%)**. 16,962 promotions were decided at total_samples = 3, the minimum. Refusals are almost all `failed_out_pruned` (1,200 in June).
- **In September, 19,853 promote evaluations covered only 55 distinct templates, about 360 each.** The top one, `gap-closing:typecheck-goal-host-vessel-src-index-l1445-ts2352-1781766427182` (June-era), was evaluated 628 times, most recently at 03:59 today. The gate re-promotes the same already-promoted templates in a loop (write amplification).
- The templates still exist, but **38 `activity` rows are near-duplicate gap-closing templates for that one tsc error (l1445 TS2352)**. There are 98 `gap-closing:typecheck-*` and **1,925 `gap-closing:*` rows out of 4,010 activities**. CONFIRMED.

### 3.5 Other learning tables
- `impulse` (107,865; concept-db's `003-impulse-table`, shared with activity-api) has only 6 shapes:
  - **cluster_shadow_decision 73,941 (68%)**: 09: 58,696, 07: 11,483. Written by activity-api D5.3 (`routes/activities.ts:7420`). **Its only reader is `test/selector-cluster-shadow.test.ts`.** Shadow mode was never promoted and nothing reads the rows.
  - conceptUpkeepAuditLog 24,183: a write-audit on every concept write.
  - environmentBaseline 7,983, operationalStateSnapshot 1,126, falsifierBaseline 144: development-vessel causal adjudication and operational state.
  - upkeepAuditLog 488.
  84,533 rows were added in September. The table takes 45-70 s to count or GROUP BY, and it is not in either trace-retention sweep. This growth axis is **outside the trace-store work** (trace-store-db, dormant-mechanism). CONFIRMED.
- `embedding_prior_weights` 5,130: a ridge model retrained about every 15 min (latest 04:21 today, n_training_samples 497). All versions are kept and only the latest is read (`embedding-prior.ts:127`). Pure accumulation.
- `signature_cluster_run` 4,168 (running monthly: 06: 36, 07: 1,267, 08: 1,092, 09: 1,773). `execution_exemplar` 2,967, all from September. `successor_features` 2,681. These are alive.
- `substrate_observable`: stability 1,891, learning_liveness 281, test 1.
- `llm_router_decisions` 162: e.g. goal_target_inference on `llm-resolver-vessel@syzygy-hub`, n = 6,910, alpha 4,495 / beta 2,417, `sum_cost_usd 0.0` (cost not recorded).
- `code_modification_proposal` 2: one targets the now-deleted `docs/architecture/CONCURRENT_COMPOSE.md`.
- `test_registration` 3, `test_report` 2 (06-17). The test ledger is effectively unused.

---

## 4. Problem classes this shard adds or sharpens

1. **write-read-mismatch at the lesson channel.** The lesson grading write goes to a nonexistent route with the wrong body shape, errors swallowed (09-09 substrate-authored). The whole corpus is ungraded (succeeded = 0).
2. **node-locality.** Node 2 reads concepts via discovery but writes via a hardcoded 127.0.0.1:8260 that nothing serves. 300+26 lost writes in 6 h; principles are probably empty there; the rejection file is node-local.
3. **memory-recall / information at the right time.** Nine search "fixes" and the fallback leg is still 94% empty. Generic July lessons win retrieval while the precise 09-xx lessons have L=0. Principles are unfiltered after the 08-09 misdiagnosis.
4. **gap-content / autonomous-regression.** The duplicate 007 migrations (substrate-authored) left the source_type vocabulary open, giving ~200 values and 985 singleton shapes.
5. **docs-drift.** 25% of doc-derived concepts describe deleted files or headings, with no retirement field. 96 sections were double-ingested.
6. **dormant-mechanism.** concept_edge (53% dangling, 0.4% ever traversed, no creation since June); upkeep disabled; relevance_feedback endpoint with 0 rows; cluster_shadow_decision with 74k rows and no reader.
7. **hollow gate.** The promote gate re-evaluates 55 templates about 360× a month at 99.7% promote. `grounded` is never true. 1,915 success-but-not-reached outcomes.
8. **sync-deploy-drift / trace-store-db.** Migration ledger with a non-enforced UNIQUE, ghost ledger names, 13 duplicate prefixes, an unledgered concept-db schema re-run on every boot, env-gated identity migrations, host clones 44 and 7 behind.
9. **test-residue-live-state.** 22 scratch databases on the live server; 260 fixture-goal labels in the oracle corpus; `operator_write_probe` concepts; a "PROBE do not use" compose_lesson.

## 5. Keep / fossil recommendations (for the realignment)
- **Keep (general seams):**
  - concept-db hybrid search (the FTS two-stage + record-id hydrate + telemetry are good), but move the filter *into* the candidate set (per-source_type partitions or a pre-filtered KNN) instead of post-filtering.
  - `DenseLegStats` telemetry.
  - `createConcept` dedup, but index `content` or hash it.
  - decision_outcome capture. goal_verification_labels, if the labeler/grounded semantics are fixed.
- **Fix first:**
  - The lesson grading route and body.
  - The endpoint in dev-vessel's concept writes: resolve via discovery exactly as reads do.
  - A source_type allowlist done as one migration (not two conflicting 007s).
  - A retirement field for doc-derived concepts, with the docs-align loop writing it.
- **Fossil / purge candidates:**
  - The 38 empty tables and the `migrations` table.
  - `vessel_heartbeats`/`replication_state` rows.
  - The 22 scratch DBs.
  - Dangling concept_edges (11,952).
  - Unread `cluster_shadow_decision` impulses (74k).
  - Old `embedding_prior_weights` versions (5,129).
  - The 38 duplicate l1445 gap-closing templates.
  - Boilerplate compose_lessons.
  - The duplicate `default`-org lessons.
