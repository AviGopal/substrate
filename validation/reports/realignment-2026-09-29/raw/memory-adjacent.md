# memory-adjacent — predecessor and adjacent operator memory (round 2)

Source key: `memory-adjacent`. Read-only extraction, written 2026-09-28/29 (UTC).

## Coverage

Read:
- `~/.claude/projects/-home-avi-documents-work-exp-repo-metabob-devbob/memory/`: `MEMORY.md` (16.5 KB) plus 70 live notes, and the 374-file `_archive_2026_07_03/`. For every archive note I extracted the frontmatter description. About 45 notes were read in depth: the ones that map to today's recurring classes.
- `~/.claude/projects/-home-avi-documents-work-substrate-utils/memory/`: all 18 notes. Eight were read in full: gap-closing loop, topology, UI spoke, trace store, submodule bump, durable update path, federation dialability, and surface goal-host.
- `metabob-mcp/memory` (3), `metabob-dashboard/memory` (9), `exp-repo/memory` (3), `vast-ai-vllm-interface/memory` (2), `scratch-perspective/memory` (6), `scratch/memory` (10), and `/tmp/imp-audit-proj/memory` (1, a probe stub). All were read. `scratch` is a separate game project; only `substrate-eval-state.md` is relevant.
- Live checks, all read-only:
  - node-1 SurrealDB via q.sh: namespaces; concept store census; `surrealdb_gotcha` duplication; phrase probes for distilled findings, with a positive control; `upkeep_stats`; `execution` count.
  - node-1 memory store files under `/workspace/memory` and `/workspace/git/super-repo/memory`: counts and date ranges.
  - development-vessel git log for 09-21..09-27.
  - the activity-api journal for `[trace-retention]`.

Framing corrections:
- **Nothing in these dirs predates 01-30.** The critic called devbob "the metabob-devbob era, before the super-repo's 01-30 start", but the super-repo's first commit is 5a663c16 on 2026-01-30. The earliest devbob artifact is `jiggle_and_prune_cleanup_2026_04_24`, and exp-repo starts 04-27. The devbob memory therefore covers **2026-04-22 → 2026-07-08**, a middle era of the same system. **01-30 → 04-22 is a hole that no memory dir covers.** Round 3 needs git history or other transcripts for it.
- Devbob and substrate-utils have **no transcripts** (`*.jsonl`) on disk. metabob-mcp has 3 transcripts (5.6 MB) and metabob-dashboard has 6 (14 MB). None of those were mined.
- Side effect to disclose: I wrote a scratch extraction to `/tmp/devbob_arch_desc.txt` (the archive descriptions, 375 lines). No other files were written.

---

## A. The recurrence chains (same class, new hat, each link declared fixed)

Every link gives: date, what was found, what was declared, and what the next link showed.

### A1. trace-store-db: trace bloat and the retention that "is enabled"
- 05-05: `percolation_2026_05_05_trace_storage_redesign_session3` — SurrealDB OOMKill #2 (F-V24..F-V27).
- 06-15 (`finding_2026_06_15_trace_store_bloat_ratelimiter`): `activity_execution_traces` held 107,397 rows. 46,543 were `validator-dispatch`, **all failures**, with `template_id=NONE`. The GET took ~5 s, and that was the loop's rate limiter. The operator deleted the 46,543 rows (5.3 s → 3.0 s). Durable fix: "not yet done".
- 06-15 (`trace_latency_is_contention`): latency is Bun event-loop contention, not a single slow query.
- 06-16 (`trace_retention_sweep_built`): stratified sweep `trace-retention.ts` built, **container-only and uncommitted**. The store had re-bloated to 110K.
- 06-16 (`datetime_string_param_defeats_index`): comparing an indexed datetime to a string param did a full scan; fixed the hot path from 7 s to 0.25 s. (`define_index_nonconvergent_on_aet`): a bulk DEFINE INDEX on a populated table never completes.
- 06-21 (`trace_store_pruned_recurring_sweep_enabled`): pruned 265,045 → 160,443 (108,564 deleted), then `TRACE_RETENTION_ENABLED=true` in gen-env.sh (super-repo `ae447b449`). **Declared: "The flooders can no longer re-bloat the store."** Same note: "pruning did NOT fix read latency" (8.56 s before and after).
- 06-21 (`throughput_lie_created_at_fullscan`): the autonomy throughput metric read 0 for 4 h because `created_at` is unindexed.
- 07-02: the retention sweep "destroyed evidence" for ~2,000 informed cells, so SF coverage has a measured ceiling of ~18.5% (`finding_2026_07_03_learning_transfer_causal_ledger`). This is retention as a data-loss path.
- 07-08 (`finding_2026_07_08_tracestore_bloat_retention_deadlock`): 219,905 rows / 13 GB, surreal at 247% CPU / 16.9 GB RSS, and `LIMIT 100` took 14.7 s. Retention was "ENABLED" but **deleted 0 every cycle**: only the two hard-coded strata were touched, and the auto-discover `GROUP BY activity_id` timed out on the very table it exists to bound. That is a **deadlock**. The trace-digest read-swap was also a wrong-premise fix: a `trace_digest` table already existed, so the new `activity_execution_trace_digest` was redundant dead code.
- 07-26 / 08-08 (substrate-utils `substrate-trace-store-live-topology.md`): the canonical table had moved to `execution`, capped at 150k. On 07-26 retention was "ON and enforcing". **On 08-08 it was measured at 267,491 rows (1.78× the cap), `upkeep_stats` empty, and "configured but NOT enforcing".** Other 08-08 readings: RSS 21.3 G against 3.4 G `memory_allocated`, 16 indexes on `execution`, an unindexed scan of 15.2 s, and `execution_trace_content` growing 4.3× in 13 days.
- 09-25 (substrate MEMORY index): "trace store is unreclaimed blobs".
- **LIVE 09-29 04:15:** `execution` = 150,267, so the cap now holds. The journal shows the `global-ceiling valve` removing 403 rows but with **batch FAILED — quarantining and advancing** (125 quarantined, 5 quarantine failures), and orphan content reaping 3,498. **`upkeep_stats` is still 0 rows**: the retention writes no upkeep record, or writes it somewhere else. SurrealDB `memory_usage` is 20.67 GB against `memory_allocated` 1.37 GB, the same unreturned-memory signature as 08-08.
- Namespaces `scratch_test`, `'scratch_test'` (the quoted twin), and `audit-scratch` are present in the live root. That is test residue.
- Recurrences: 7 declared fixes across 05-05 → 09-25. The class never went away. The mechanism has been rebuilt at least three times (manual prune, sweep, ceiling valve), and each time "enabled" was taken as "working".

### A2. memory-recall: the system's memory reset, split or archived, and each time "handled"
- 05-23 (`feedback_memory_as_substrate`): memoryNote made authoritative. The files were to become a derived cache, with `migrate-memory-to-substrate.ts` bulk-emitting ~70 notes and a manifest at `validation/state/memory-migration-manifest.json`. The "bridge path" (`pending_sync: true`) was the operating reality. The closure criterion was "`closure-audit --without=operator-memory` green 3 nights".
- 07-03: devbob `MEMORY.md` says the 374 `finding_*`/`percolation_*` notes were "distilled into concept-db and archived". **Live check 09-29:** there is 1 concept each for `causal_discipline`, `selection_decision_shape` and `idiomatic_restatement_moves`, 75 with `source_type=memoryNote`, 8 `operator-memory-consolidation`, 4 containing `MITOSIS_DIRECT_PUSH`, and 1 containing "surgical gate". The positive control (`compose_lesson` containing `old_string`) returned 7. So the distillation left traces but is far smaller than 374 findings, and **no reader of it was verified**.
- 05-27 → 07-23: the node-1 file `/workspace/memory/notes.json` holds **680 notes** (287 finding, 266 project, 87 feedback, 40 reference; 3.1 MB). It stops on 07-23. The 09-22 index says these were "unread since Jul 25" because the unit's `WORKSPACE_ROOT=/workspace` lost to the EnvironmentFile's super-repo root.
- 08-08 (substrate-utils): the WORKSPACE_ROOT trap. `WORKSPACE_ROOT=/workspace/git/super-repo`, and `/workspace/policies/llm-model-policy.json` is "a STALE DECOY frozen at 2026-07-28". The gap store also has two paths (`/workspace/gaps/` hardcoded in boredom-vessel against `/workspace/git/super-repo/gaps/gaps.json`) — "DIFFERENT FILES, a real inconsistency". **This is the same split that the 09-22 "two memory stores" finding rediscovered for memory.**
- 09-22 23:15 UTC: backup `notes.json.pre-merge.1790118911018.bak` holds 1,077 notes (08-17 → 09-22; 1,046 of them reference). Merge at file level: 1,077 + 680 → 1,788. **One note carries a literal `{{now}}` `created_at`**, an unresolved template placeholder in live memory.
- 09-22 23:19 / 23:48: development-vessel `b5ed109` "the memory store has no retire primitive so battery residue accumulates forever", then `19ae84e` (route-edit, the retire primitive).
- 09-23 03:56: `d4171b1` "the expectation-trend checker never retires the probe notes it grades".
- 09-23 04:39: `pre-residue-cleanup` bak, 1,780 notes.
- 09-23 05:08: `pre-op-retire` bak, 1,788 notes.
- 09-23 11:22: `4332e38` recommit (narrowed, wrong_location). 09-23 11:55: `dac3c2c`, memory-note write rejects a numeric body.
- **LIVE 09-29:** `/workspace/git/super-repo/memory/notes.json` has **59 notes, oldest 2026-09-26 05:12**. The authoritative memory lost everything before 09-26.
  - **Candidate cause**, not a verdict: the retire and cleanup landings of 09-22/09-23 open a ~72 h window (09-23 05:08 → 09-26 05:12).
  - The 09-28 check-in (44ab5fd4) says "cause not established". It also records that the operator's 50830bec deleted `state/learning-mode-state.json` in the clone on pull, which reset the learning-mode state.
- 09-29 03:35 (9c967329): the memory need 879c4bc6 was not reached. Goal-target inference found **no shape for "memory"/"recall"** (confidence 0), and the walk ran pool leftovers until it went hollow.
- Recurrences: memory has been reset or split at least **five** times: 05-23 bridge, 07-03 distill+archive, 07-23 store orphaned, 09-22 merge, 09-23→26 collapse. Each was declared handled (migration script, distillation, merge, retire primitive with "falsifier 6/6").

### A3. hollow-landing: the gate passes a change that does nothing
- 06-06 (`drafter_schema_drift_blocks_chain`): **193/193** proposals on disk failed boundary 1. The drafter emitted a gap-analysis schema, not patch_proposal.
- 06-18 (`surgical_pregate_unblocks_self_alteration`, then `surgical_gate_overrefusal_starved_funnel`): the gate went from too loose to over-refusing, with a 5 h flatline.
- 06-19 (`funnel_apply_works_but_gate_misses_semantic_noop`): `patch_with_tools` deviated from the anchor and the FAVORABLE gate (tsc) passed a semantic no-op.
- 06-25 (`cutover_works_but_verify_gate_semantically_blind`): the gate went FAVORABLE on a synthesized `recordOutcome`/`isNoOpBody` with **zero callers** whose body was `void success; void body;`. The real penalty path (`penaliseHollowTemplate`, 1472/1652 invocations) was untouched. Named "lever 5".
- 07-01 (`gap_spec_crispness_and_dataflow_blindspot`): semantic gate v1 misses dead DATA FLOW (a value consumed but never populated). D1a landed as 64fd66d with 2 defects caught in operator review.
- 07-04: the semantic gate now rejects dead code, e.g. a helper without a caller or a `.catch(()=>{})` empty body. But `gap-semantic-gate-import-false-positive` shows that Rule B keys by absolute path and flags every braces-import. Rollback also left post-op bytes twice (`gap-compose-rollback-nonrestoring`).
- 09-15 (substrate index): `hollow_write` — inert commits go green and seal the gap.
- 09-24: a landed-vs-parent diff caught a silent revert (6ab8271 undid a0ff3d3).
- Recurrences: 6+. Each gate generation fixes the last hat and admits a new one, because every gate reads the diff and none measures the defect.

### A4. narrowing-duplicates: re-emission, duplicate rows, and wiped counters
- 06-14 (`gap_scenario_class_dedup`): **7,879 scenario files over 259 classes**. The drafter's pick had about 1/7879 odds of a new class. Fix: `classKey()` plus a one-shot prune → 259. It was "LIVE, uncommitted on host".
- 06-22 (`concept_to_edge_conversion_blocked_by_duplicate_minting`): the drafter minted a 10th producer of `activityExecutionSummary` instead of composing the existing ones.
- 06-25 (`ribosome_live_path_dead_ws_contract_drift`): ribosome ids of the form `learned-<slug>-<timestamp>` produced "Apply Proposal as Patch" ×11, among others. Fix `fdcd0ec`: id = `learned-<parent-slug>` with UPSERT.
- 07-01 (`gap_failed_attempts_wipe_starved_loop`): the substrate-gap UPSERT did `gap = {...incoming}`, which wiped `failed_attempts`. One gap monopolized gap-compose, with 0 lands in 3 h. The fix is `2757099`. The same bug existed in two more paths (`63d6a67`: orphaned_capability and capability_gap routes never bumped). Lesson written: "any UPSERT that BLINDLY overwrites on re-emission destroys accumulated learning state".
- 07-04 (Continuation 6): gap store 1,768 rows, **57% (1,004) goal-host auto-draft telemetry**. `gapClassKey` stripped timestamps but not UUIDs; open count 672 → 540. Consumption gate `52810c0`: K=3 via env `GAP_CLASS_OPEN_CAP` (see A11).
- 07-04 (Continuation 7): concept store 12,360, **49.5% (6,119) from one emitter** (autocomplete-concept-writer, exec id embedded in content). A janitor drains 50 per 15 min.
- 09-22 / 09-26 (substrate index): `-narrowed` child = verbatim duplicate; the recommit family.
- **LIVE 09-29:** concept store **88,565** rows, of which **76,812 (86.7%) are `source_type=impulse_signature`**. This is the per-execution noise class back under a new source_type. `surrealdb_gotcha` has 582 rows (575 of them `impulse_signature`) over **8 distinct contents**. Never-loaded is 35,051/88,565 (39.6%, against 90.2% on 07-04), so loading improved while the dilution grew 7×.
- Recurrences: 7+.

### A5. endpoint-routing: pinned peers and broken resolve contracts
- 05-25 (`percolation_2026_05_25_discovery_registry_fixes`): three `VESSEL_ID`/`VESSEL_ENDPOINT` collisions dropped dev-vessel, concept-db and activity-api from discovery.
- 06-22 (`obsidian_feedback_loop_severed_endpoint`): the obsidian resolvers default to `OBSIDIAN_PLUGIN_ENDPOINT ?? "http://host.docker.internal:27183"` (dead). The live plugin was at `127.0.0.1:27182`. Fixed by **repointing the env** (super-repo `41feb26b3`, gen-env.sh), i.e. another pin.
- 07-04 (`env_gate_elimination`): activity-api `discoverVesselsForShape` POSTed a bare `{shape}`, but discovery needs `{pointer:{type:"vesselCapability",shape}}`. It returned **"HTTP 400 forever, zero callers had ever noticed"** because the only caller was env-disabled (`3013e76`).
- 07-05 (`hub_spoke_shellresult_break`): every hub vessel registered a loopback endpoint (`127.0.0.1:8080`, …), unreachable from any other machine. MCP `registry_query` read "a STALE/different registry".
- 07-26 (substrate-utils): the resolve path must use the pointer envelope, otherwise 400.
- 08-08 (substrate-utils `surface-goal-host-unreachable`): the hub goal-host was registered with the **federation transport's address `:8401`**, which `reachableFrom()` rewrote to `syzygy.host:18401` → 000. Cause: a 401 heartbeat storm led to TTL expiry and a bad re-register. Workaround: **pin `GOAL_HOST_ENDPOINT=http://172.17.0.1:18210`**.
- 08-10: the hub IP moved from 138.197.116.56 to 104.236.0.175, and a cached literal made a healthy hub read as down. Registry listing endpoints 404 on the hub, and "grep -c over a 404 body" read as 0 rows.
- 08-21 (metabob-mcp): "goal-host's discovery row is stale (127.0.0.1:18401) which breaks run_goal*/goal_status/goal_reasoning/provide_feedback".
- 09-22 (substrate index): the resolve-URL joiner overshot (endpoint + absolute resolvePath = invalid URL, so "no producer"). 248 escalations went to the **pinned `:8270`**, a replaced vessel.
- Recurrences: 8. The pattern is the same each time: a writer or caller pins a peer (or a path format), the peer changes, and the failure reads as "no producer" or silence.

### A6. autonomous-regression: a self-edit bricks the authoring vessel
- 06-15 (`self_alteration_authors_but_cutover_livelocks`) and 06-17: cutovers livelocked.
- 07-08 (`devvessel_crashloop_selfedit_deadlock`): a feature_compose self-edit duplicated the `hasLessons` block in gap-to-feature.ts. dev-vessel went to **NRestarts=61**, and since it hosts feature_compose this was a **bootstrap deadlock**. An earlier duplicate `logger` came the same session. The note asked for "a pre-cutover typecheck gate that specifically catches TS2300/TS2451 duplicate-identifier on the vessel's OWN source".
- 08-08 (substrate-utils `durable-update-path`): a unit drop-in says the rendered unit "lost the repos/development-vessel segment and crash-looped 2400+ times".
- 09-19 (substrate index): an unparseable autonomous commit reached origin/dev. **1,404 restarts in 4 h, zero gaps.** The detector watched 14 timers and 0 services.
- Recurrences: 3 or more crash-loops. The 07-08 detector request was not built before 09-19.

### A7. false-verification: query and measurement artifacts read as system state
- 06-14 (`evidence_seam_is_the_break`): "samples=0, loop never closes" was a **query artifact**. `template.metrics.total_executions` reads 0, and `/execution-traces?limit=N` returns **oldest-first**.
- 06-15 (`authored_activity_promote_blocked_trace_attribution`): "no trace under activity_id" was an `activity:`-prefix filter artifact.
- 06-17 (`detector_reality_calibration`): break-on-short-page pagination truncated **4 lift-gate detectors** to a sliver of the corpus.
- 06-17 (`lift_gate_flapped_on_wrongtype_500`): the headline lift gate flapped on a Redis WRONGTYPE 500.
- 06-17 (`scope_creep_blocked_cutovers_3days`): a "3-day stall" was actually a filter on the wrong repo path; cutovers had moved to MITOSIS_DIRECT_PUSH.
- 06-18 (`autonomy_status_view_and_gap_metric_repair`): a null-unsafe sort blinded the gap metric from 06-17 21:47.
- 06-19 (`honest_landing_metric`): `landed` counted `.applied` files, which are written on every outcome, and froze at ~302. Also `autonomy_status_must_run_on_host`: run in-container, it read a stale bind-mount cache and reported 850 m-old data.
- 06-19 (`lift_gate_stability_counted_edges_as_instability`) and (`stale_spectral_gap_misranked_dec_limiter`): an 11.5 h-stale host jsonl gave λ₂=0.94 against a live 0.54.
- 06-20 (`lift_gate_unblinded`): overall_passing=null permanently, because one contended page aborted the 1,693-template fetch.
- 06-21 (`throughput_lie_created_at_fullscan`), 06-25 (`ribosome…`): "0 mints" came from keying on `metadata.author`, which the SCHEMAFULL table strips; the real count was 106.
- 06-27 (`working_graph_connected_lambda1_was_graveyard`): the "λ₁=0 binding constraint" was largely a measurement artifact.
- 07-31 (substrate-utils `gap-closing-loop`): the "trigger starvation" hypothesis was WRONG. It was light-dispatch with empty `input_impulses`.
- 08-08 (substrate-utils `submodule-bump-frozen`): `bump-submodules.yml` resolved 0 submodules, **reported GREEN every 6 h, never bumped a pointer**. Fixed to exit non-zero (`851c472`).
- 08-08 (substrate-utils): every `substrateGap_write` on the hub **500'd for days**. One hand-written row used `gap_status`, and `gapClassKey(undefined)` threw. Detectors fired and nothing was filed (`e8d4405`).
- 08-10: `/api/gaps` fail-softs to `{"gaps":[]}` when upstream is down; a hub blocker was declared and never re-probed (it had self-healed 14 minutes later).
- Recurrences: 15+. This is the single most repeated class in the shard. The 09-15 "positive control shares the address" law appears in the substrate cache as new, but the substrate-utils notes of 08-08 and 08-10 already state it: "never collapse *tool failed* into *tool found nothing*" and "did it actually do anything, or does it only look fine?".

### A8. selection-learning: posteriors that do not move, or move for the wrong reason
- 05-25 (`thompson_fixes`): two root causes blocked posterior updates; F-069 `UPSERT..CONTENT` reset posteriors (`metabob_migration`).
- 05-26 (`s4a_boredom_fixes`): boredom picked high-alpha templates 74% of the time.
- 06-14 (`reward_saturation_fixed`): reward was completion, not yield, so 86% of templates sat at mean=1.0.
- 06-15 (`authored_activity_graduation_unblocked`): engagement/relevance-polluted posteriors retired authored activities.
- 06-17 (`forward_model_poisoning_and_audit`): **errorless benign no-ops recorded as β**. `create-shape-provider-goal` had α=1423 / β=11115; `resolver-author` had mean 0.004. All 37,810 failed traces had no error and no failure_mode. `recompute-poisoned-posteriors.ts` (`460cc35a2`) reset 26 variants by hand. **The durable fix was upstream and "not done".**
- 06-21 (`m2_state_signature_starvation`): conditional keying was built but **0/237,86x traces carried input shapes**, so `context_thompson_scores` had 20 rows. Two executor fixes landed; 06-26 reported "signature starvation is FIXED (98% coverage)".
- 06-23 (`boredom_selector_nan_pin`): the selector was pinned on a NaN score; guarded with `Number.isFinite` and the root was not found.
- 06-25 (lever 3): the cross-signature reputation penalty landed **flag-gated, "inert live until context_thompson_scores populates"**.
- 06-30 (`thompson_no_results_warn_is_cosmetic`): a legacy counter miss.
- 07-04: honest no-op skip-success repeated three times (variant_promote, apply-proposal, mitosis-tick).
- 07-31 (substrate-utils): the drafter fired 4,649 times with 0 successes, and **its Thompson counters read 0/0/0**, so the bandit never demoted it. There was no circuit breaker (`vessel_circuit_breaker` 0 rows).
- 08-06 → 08-08 (substrate-utils serverless): a cost-0 seeded arm was fixed; "the bandit's cost term is capped at cost_weight (0.25)", so a cold arm cannot be priced.
- Later links in the substrate cache: 08-18 `thompson_posterior` fabricates Beta(1,1) `loaded:true`; 09-12 two belief tables use different field names.
- Recurrences: 10+.

### A9. node-locality: work happens on a node the measurement is not looking at
- 06-19 (`substrate_host_detach`): substrate-live state moved to named volumes.
- 07-02 (`three_location_operational_space_live`): hub, spoke and operator-host Obsidian shared one space.
- 07-05 (`hub_spoke_shellresult_break`): activity-api moved to the hub. local-tools was not deployed there, so `shellResult` had 0 producers and **feature_compose hard-failed every edit goal before drafting**. The self-authoring loop cannot author its own shell dependency. The operator's ruling was placement by data locality.
- 07-31 (substrate-utils): **the autonomous loop runs on the SPOKE**. Of ~9,200 executions/day replicated into the hub DB, **9,199 are `local-dev-spoke`** and only ~48 come from the hub. "The system runs hard but mints nothing" means the spoke runs hard.
- 08-10 (substrate-utils): **both local containers are spokes**; the hub is a remote droplet, and `localhost:18100` is a different registry. A throwaway probe `hsv-probe` registered itself, was mirrored fleet-wide, and survived the death of its process (A12).
- Recurrences: 4 in this shard. The node-2 vs hub hat of 09-xx continues it.

### A10. sync-deploy-drift: a fix that is committed but not running
- 06-16 (`cutover_reliability_and_upstream_drift`): cutover push had to survive upstream drift (fetch, rebase, retry).
- 06-17 (`scope_creep_…`): untracked files blocked the host-sync-poller gate.
- 06-19 (`cadence_timer_durability`): the cadence timers were never in Dockerfile.substrate's `systemctl enable` list, so they were lost on recreate (`2600dab35`).
- 06-26 (`scripts_units_run_readonly_stale_bind`): the scripts units run a read-only, bind-lagged copy. (`self_activation_without_restart`): an `activate_substrate_script` resolver was added as a workaround.
- 06-30 (`mint_drought_stale_process`): a **2-day fleet-wide mint drought** came from a stale activity-api process whose fixes were committed but not loaded.
- 07-01 (`self_recovery_autoimmune_docker_in_container`): the fix waited hours on bind lag.
- 07-02 (`self_contained_substrate_p1_p3_landed`): a recreate regenerated `SURREAL_PASS` and broke auth.
- 08-08 (substrate-utils):
  - Hot-patching `/vessels` is reverted by pull-sync every 10 minutes.
  - **dev-vessel runs from `/workspace/git/super-repo/repos/development-vessel`, not `/vessels`**, so a mirrored fix "does NOTHING".
  - pull-sync **skips a dirty submodule**, and the substrate authors code into that same tree.
  - `bump-submodules.yml` never worked.
  - The super-repo clone was on branch `development-vessel`, not `dev`: 97 behind, frozen for days.
  - Committed agent worktrees (gitlinks in `.claude/worktrees/agent-*`) broke `--recursive`.
- 08-10 (substrate-utils `ui-spoke-masked`): an enabled `.timer` with a masked `.service` is silently inert. The spoke sat 42 commits behind, on a pre-fix container (the fix `fabeb82e` already existed). A `ui-only-up.sh` guard is dead code under `set -euo pipefail`.
- 09-22 (substrate index): authorability = submodule membership; human-surface, clock and relevance-sink are plain files, so there is no push clone.
- Recurrences: 12+.

### A11. env-gating (law 1): behaviour hidden behind env
- 06-16 (`self_alteration_cutover_closed`): "**MITOSIS_DIRECT_PUSH was the one missing knob**".
- 06-21 (`reuse_before_mint_shadow`): `REUSE_BEFORE_MINT=shadow` by default.
- 06-25 (lever 3): flag-gated.
- 07-02 (`activity_repair_interception`): `ROUTE_ACTIVITY_REPAIR=0` probe; the interception still carries load.
- 07-04 (`env_gate_elimination`): the detector's first run found **15 sites / 14 env vars** gating capability while unset:
  - DENSE_BACKFILL_ENABLED, WRITE_ALLOWLIST, MITOSIS_HOST_SYNC_MODE, SUBSTRATE_AUTO_DRAFT_ENABLED, SUBSTRATE_AUTHORING_DECISION_EMIT
  - EMBEDDING_PROVIDER, PRIOR_SEED_ENABLED, TD_LAMBDA, SF_*, THOMPSON_SAMPLING_SEED
  - KUBERNETES_SERVICE_HOST, PARADIGM_READ_PERCENTAGE

  CONCEPT_DB_URL was eliminated through discovery. "ONE env gate hid THREE more silent-disable layers." The same day the **consumption gate was minted as env `GAP_CLASS_OPEN_CAP`**, a new env gate.
- 07-04 (`conceptdb_utilization_audit`): the prior-seed was "WIRED-BUT-DISABLED" by a missing env var.
- 07-24 (vast-ai): vLLM providers were env-injected (`VLLM_ENDPOINTS`, `LLM_UNREACHABLE_COOLDOWN_MS`).
- 08-08: `TRACE_STORE_CAP` / `TRACE_RETENTION_*` env.
- Recurrences: 7+. Env gates are removed on one side and minted on the other in the same session.

### A12. test-residue-live-state
- 06-13 (`self_audit_blind_mitosis_pollution`): **245/263 `/vessels` dirs were abandoned mitosis dirs**, which blinded the self-audit (20-cap).
- 06-14 (`workspace_fd_leak_wedge`): 68k light-dispatch artifact dirs caused an EMFILE wedge.
- 06-14 (`producer_adapter_and_trace_honesty`): a trace-filter false positive.
- 06-15 (`obsidian_human_forward_model`): the observation channel was 100% substrate-write file-creates (self-pollution).
- 06-22 (`feature_selfalter_authors_prolifically`): `/vessels` held 69 dirs, including **~40 AI-authored vessels** (autofixer, reasoner, tutor-bot, archon, hal …).
- 08-10 (substrate-utils): the throwaway `PORT=8397 VESSEL_ID=hsv-probe` was mirrored fleet-wide as `hsv-probe@spoke-94988b6f` and **survived process death**; the transport pushed a cached snapshot.
- LIVE 09-29: namespaces `scratch_test`, `'scratch_test'` and `audit-scratch` exist in node-1 SurrealDB. The `{{now}}` memory note is also present.
- Recurrences: 6.

### A13. dormant-mechanism: built, validated once, then unused
- 06-17 (`composition_graph_edge_table_unpopulated`): 0 edges while 30K traces carried composition_chain; no writer.
- 06-19 (`orthogonal_synthesis_binding_bug`): observe-orthogonal-patterns had been **DORMANT since 06-02**.
- 06-23 (`operator_capability_resolvers_orphaned`): every operator-facing capability resolver was alive, with **0 activities invoking them**.
- 06-24 (`analysis_vessel_problem_detection_inert`).
- 06-25 (ribosome-vessel): the WS observer was dead and redundant, with 0 dispatches in 26 h.
- 07-04 (`conceptdb_utilization_audit`):
  - Drafter templates' `prime_substrate_concepts`: **0 executions in 7 d**.
  - ExecutionObserver "connected-but-yielding-nothing".
  - Concept consult at goal failure: **NO**.
  - `prior_seed_efficacy_scan` landed "on-demand (not tick-registered)".
- 08-08 (substrate-utils): the qwen3-coder-next H200 endpoint was live but **UNUSED** (no integration), with 3 standby workers warm. On 09-18 it was in real use (93,025 jobs).
- 08-08: retention enabled, deleting 0; `upkeep_stats` empty (still 0 on 09-29).
- Recurrences: 9+.

### A14. drafter-quality and gap-content
- 06-01 (`drafter_chain_truncation`): the drafter halted after write_proposal.
- 06-06: schema drift, 193/193.
- 06-12 (`drafter_v37`): the "real root cause" was fixed.
- 06-17 (`autonomous_chain_stalls_at_patch_convergence`), (`code_search_blind`): code_search returned 1 match.
- 06-19 (`drafter_file_path_hallucination`): `file_path_hallucination` was 18/24 rejections, caused by reading `target_file` (always empty) instead of `target_file_paths[0]`. Then `bottleneck_moved_to_patcher_anchor_supply`.
- 07-01 (`gap_spec_crispness_is_a_surface_lever`): a crisp, single-scope spec went FAVORABLE where a verbose one on the same change went UNFAVORABLE.
- 07-03 ("plan had no ops"): completion truncation.
- 07-04 (compose lessons → concept-db, `e6de357` / `2ab1c4b`): lessons are written at class grain, e.g. `anchor_not_found`, `empty_diff_identity_edit`, `partial_spec_omission`.
- 07-08: `hasLessons` was duplicated and the file was too big for the drafter.
- 07-31 (substrate-utils): the drafter failed **100% (4,649/4,649)** on a literal `{{report_path}}`, because light-dispatch delivered empty `input_impulses`. This was 37% of all failures. It was filed 07-04 as `gap-draft-gap-closing-unbound-report-path`, with **P3 "gets closed by the loop without operator code"**. **Still failing 07-31**, so P3 failed.
- Substrate cache: 09-13 operator specs reach 80% while autonomous specs reach 2.5%. 09-27: prose goals dropped 2/3 of the edits.
- Recurrences: 10+.

### A15. human-surface-escalation
- 06-15 (`operator_goal_unservable_detection`): a free-text goal hit fallback_tier=refused, then ~90 s of silence, then a cryptic error.
- 06-15/16: obsidian inbox/request loop built. 06-22: the RESPOND+GRADE half had its resolvers **unregistered**. 06-22 (`obsidian_loop_functional_not_autonomous`): functional, but no tick dispatches it.
- 08-08/08-10 (substrate-utils): the surface spoke's goal dispatch failed for days (goal-host row pointed at `:8401`).
- 09-22 (substrate index): 248 escalations, 0 answered.
- Recurrences: 5.

### A16. composition-crystallization and goal-walk-floor
- 06-13 (`real_chain_author_revived`): draft-activity-from-pattern had been dead.
- 06-22 (`substrate_does_not_compose_to_reach_goals`); 06-22 (`compose_tick_makes_wrapper_scaffold_not_genuine_edges`).
- 06-24 (`goal_selection_is_text_not_shape_driven`): goal-host passed only goal TEXT, so the shape machinery was bypassed.
- 06-24 (`reach_gate_last_step_digest_bug`): the gate judged only the last step, giving false HOLLOW verdicts.
- 06-25 (lever 4): goal → target-shape inference, "MILESTONE … REACH end-to-end".
- 06-30: "capstone done", composite mint. Compounding had been blocked by the ribosome not setting the template's top-level `output_shapes`.
- 07-02 (`plain_dev_goals_misroute_to_maintenance_ticks`): 0 shape-feasible steps fell to recommend, which returned an unrelated tick. Fixed by an interception (`8196b33`).
- 07-07: the capability catalog is consulted pre-inference.
- **09-29 (9c967329): target inference found no shape for "memory"/"recall" (confidence 0), and the walk ran leftovers.** This is the same hat as 06-24 and 07-02, with the lever 4 "keystone" failing on a capability-described need.
- 07-31 (substrate-utils): the activity table was **stuck at 3,464 (0 new in 48 h, last real mint 07-27)** against a gap backlog of 239 open.
- Recurrences: 8+.

### A17. spend-envelope-throughput
- 06-14 (`cost_aware_selector_v30`) and 06-19 (`graded_yield_reward`).
- 06-18 (`self_development_rate_levers`): ~0.375 landings/hr.
- 06-20 (`surrealdb_write_storm`): 689% CPU from an impulse_relevance write-storm, self-amplifying and invisible to the load detector.
- 06-21 (`db_contention_fix` / `write_contention_fixed_coalescing` / `db_cost_map` / `surgical_fixes_shipped_cpu_throughput_bound`): CPU stayed at ~490% after 6 EXPLAIN-verified fixes. `surrealdb_cpu_aggregate_not_single_driver` was then CORRECTED the same day.
- 07-04: goal-host restarted ~46× in a day, and 21 of 48 cutovers interrupted dispatches.
- 08-06 (substrate-utils): capacity knobs are the user's decision ("Single worker was fine… consider cost v usage").
- Recurrences: 6.

### A18. federation-p2p
- 06-30: libp2p plan, relay vetted, egress wired. 07-02: three-location space live. 07-07: relay topology.
- 07-31 (substrate-utils): CP1 landed with self-advertise. The spoke→relay→hub→Qwen3 direction was **never executed**, and "CANNOT-vs-DO-NOT unresolved". There were 4 reactive healing layers on the reservation, and "do NOT pile on a 5th".
- 08-10: port 30333 "closed" turned out to be a transient that was declared a blocker. A spoke can consume from the hub while never being seen by it.
- 07-17 (metabob-dashboard): the discovery registry advertises internal `127.0.0.1:8xxx` endpoints, so a host-launched client cannot use them. A corporate proxy requires HTTPS discovery or relay, not raw libp2p.
- Recurrences: 4.

### A19. docs-drift and codebase-bloat-fossils
- 04-24 → 04-27: jiggle-and-prune archived 50 root files, removed 272 files, and cut active docs from 86 to 75. The user invoked jiggle-and-prune **8 times with identical args** (`feedback_jiggle_prune_loop`).
- 06-22: ~40 AI-authored vessels in `/vessels`. 07-08: a redundant `activity_execution_trace_digest` table ("should be deleted").
- 07-01 (`project_2026_07_01_docs_as_expectation_loop`): the docs-align loop shipped with autoland **off by default**.
- 07-26/08-08: the GKE Helm chart and `deploy-activity-api.yml` describe a deployment that does not exist, which led an assessment to get the engine version, cap, retention and row counts wrong. Also a legacy table triplet: `activity_execution_traces`, `activity_execution_trace`, `execution`.
- 08-16 (metabob-dashboard): `repos/metabob-cloud-dashboard` claims the same host as metabob-dashboard. The owner ruled it stale and it must not be cited. **It is a fossil still in the super-repo tree.**
- exp-repo 04-27: rpc-api deprecated in favour of identity-vessel.
- Recurrences: 6.

---

## B. Milestone and "fixed" claims ladder (what was declared, and what came next)

| Date | Claim | Later evidence |
|---|---|---|
| 05-28 | "Lift milestone — substrate authored 4+ gap-closing templates autonomously" | 06-06: 193/193 drafter proposals unconsumable; the one commit that day (ceb3098) came from an operator-dropped proposal |
| 05-31 | "S2 sustained — 3 consecutive windows" | caused by a timer 30 min→5 min change plus exit-0; 06-13: "boredom loop livelocked on mitosis-tick" |
| 06-06 | "Full drafter→apply→cutover→commit chain validated end-to-end" (ceb3098) | the operator supplied the proposal |
| 06-12 | "V37 fixed the real drafter schema-drift root cause" | 06-19 file-path hallucination 18/24; 07-31 drafter 4,649/4,649 failing |
| 06-14 | "MILESTONE autonomous code self-fix" (a55d893) | 06-17: no substrate commit for 3 days (later retracted as a wrong filter) |
| 06-14 | "substrate IS autonomous + converged on its known gap classes" | 06-17: forward model poisoned (resolver-author mean 0.004) |
| 06-16 | "Self-alteration cutover loop CLOSED — MITOSIS_DIRECT_PUSH the one missing knob" | 06-17 "stalls at patch convergence"; 06-20 "~21h of pure no_op" |
| 06-17 | "OPERATIONAL PROOF autonomous cutover" (28df8d0) and "first full self-alteration cutover landed" | 06-18 5 h flatline (surgical gate over-refusal) |
| 06-19 | "MILESTONE — both autonomy seams CLOSED" | 06-20 "self-improvement blocked by surgical gate"; 06-22 CODE self-alteration "BLOCKED at the operator boundary — 1860-proposal backlog" |
| 06-21 | "feature_compose LANDS … the full loop detect→spec→author→verify→land" | 06-28 1 h review: "STALLED (0 lands, all UNFAVORABLE)", then "CRITERION MET — corrected" the same day |
| 06-21 | "The flooders can no longer re-bloat the store" | 07-08 220K rows, retention deleted 0; 08-08 267K vs 150k cap |
| 06-24 | "first reliable cross-vessel reach" 3/3 | 07-31 honest goal reach ~17–19% |
| 06-25 | "lever 4 … natural-language goals route … and REACH" | 07-02 plain dev goals misroute; 09-29 "memory" maps to no shape |
| 06-25 | "ribosome … role dead" → CORRECTED "HEALTHY 106 templates" | 06-30 2-day mint drought (stale process); 07-31 last real mint 07-27 |
| 06-26 | "signature starvation is FIXED (98% coverage)" | 07-31 drafter posterior 0/0/0 after 4,649 runs |
| 06-28 | "full unsupervised self-development LOOP … complete and running" | 07-08 dev-vessel crash-loop deadlock; 07-31 capability set stagnant |
| 06-30 | "MILESTONE … non-surgical federation feature landed", "capstone done" | 07-31 activity table stuck at 3,464 |
| 07-04 | P3: the unbound report_path gap will be closed by the loop without operator code | 07-31: still 100% failing |
| 07-04 | P8: class dedup + gate stop duplicate re-accumulation (672→540) | 09-22 `-narrowed` verbatim dups; 09-29 concept store 86.7% `impulse_signature` |
| 07-04 | P9: concept-store per-execution noise drains via janitor | 09-29: 76,812 `impulse_signature` rows (noise under a new source_type) |
| 07-26 | "Retention is ON and enforcing" | 08-08 "configured but NOT enforcing"; 09-29 enforcing at the cap but batches failing and quarantining |
| 08-08 | "gap store was UNWRITABLE — fixed e8d4405" | 09-13 LIVE store path confusion again; 09-28 "lifecycle scan dormant on the real store" |
| 08-10 | "hub port 30333 CLOSED, needs droplet SSH" → RETRACTED 14 minutes later | — |
| 09-22 | retire primitive landed, "falsifier 6/6" | 09-26 authoritative memory restarts at 0 (candidate cause) |

Same-session retractions in this shard: 06-14 evidence seam, 06-15 trace attribution, 06-17 3-day stall, 06-20 "λ₂ was wrong", 06-21 CPU aggregate, 06-22 commit-rate flat, 06-25 ribosome dead, 06-27 λ₁=0 graveyard, 07-01 orphan MINT_FAILED mostly correct, 07-31 trigger starvation, 08-10 hub down / surface goal-host root cause. **At least 11 diagnoses were reversed within a day of being declared.** The pattern is to diagnose from a single un-controlled read and publish it.

---

## C. Mechanisms (keep / fossil / duplicate)

Marked live-used only where there is evidence of a reader; otherwise live-written or unverified.
- **trace-retention.ts sweep + global-ceiling valve** (activity-api). General. Live: enforcing at ~150k on 09-29, but batches fail and quarantine, and `upkeep_stats` has 0 rows. Status: live-used, degraded.
- **model-reality-audit.ts / recompute-poisoned-posteriors.ts** (`scripts/substrate`, 06-17). General; aggregate model-vs-reality. Unknown whether still invoked; the operator ran the recompute by hand, so it is likely a fossil.
- **systemd_unit_health_observer** (dev-vessel `abe82fe`, 06-17). Watches the timer fleet via Result/ExecMainStatus. 09-19 says the detector watched 14 timers and 0 services, so coverage regressed or it was never pointed at services. Status: broken or partial.
- **self-recovery-tick** (180 s). Fixed for the in-container context on 07-01 (`92b1b1faf`). 07-04: restarted all 3 stop incidents. 08-10: masked on the UI spoke. Live-used where not masked.
- **workspace_hygiene_observer + prune_stale_mitosis** (dev-vessel `ea458fe` / `f45b079`). Pruned 244 dirs autonomously. Unknown status.
- **gap_to_scenario_bridge classKey dedup** (06-14). Left "uncommitted on host". Superseded by gapClassKey and the consumption gate (`52810c0`). Duplicate lineage of dedup keys.
- **gap consumption gate** K=3, env `GAP_CLASS_OPEN_CAP` (`52810c0`). Env-gated. Unknown status.
- **substrate-gap UPSERT merge-preserve of failed_attempts** (`2757099`, `63d6a67`). General lesson at the shared seam. Live-used, presumed.
- **reuse-before-mint** (dev-vessel activity-create-variant, `REUSE_BEFORE_MINT=shadow`), plus the mint governor (goal-host `b45a2aa`). Env-gated shadow. Status unknown.
- **ribosome-extract lifecycle subscriber** (live minting path) against **ribosome-vessel WS observer** (dead, redundant) and **goal-host mintReachedTrace** (writes nothing pre-fix; patched then reverted). The ribosome-vessel is a fossil.
- **compose_lesson ledger → concept-db** (`e6de357` / `2ab1c4b`). The writer is live (45–52 rows). The reader (`composeLessonsBlock` semantic recall) was not verified.
- **reach_gate_lesson mirror** (goal-host `1ee2224`). The writer is live (270 rows). The reader was not verified.
- **walk-time concept consult** (goal-host `af85e2e`, 10 s cap). On 09-29 it recalled 5 unrelated concepts for the memory need, so it is live but not effective.
- **capability_catalog pre-inference consult** (07-07). Live 07-07; unknown now.
- **memoryNote resolver** (dev-vessel) plus the `substrate-memory-mirror` hook. Live, but the store lost everything pre-09-26. `migrate-memory-to-substrate.ts` and `memory-sync-tick` / `memory-pending-flush` are unverified and likely fossils.
- **concept-db distillation of operator memory** (07-03). Partial traces only. Treat it as a fossil or archive, not teaching.
- **autonomy-metrics collector / autonomy-status view / criterion-coverage view** (06-17..06-19). Host-side, operator-read only. Likely fossils.
- **spectral-gap governor / compose-teacher.timer / funnel-drain.timer / composition-edge-reconcile** (06-19). The Dockerfile enable list was fixed; current use is unknown.
- **env_gate_scan** (dev-vessel `744a3cd`). General detector for law 1. Status unknown.
- **drain-before-restart + durable dispatch records + interrupted executionId** (07-04: `f6ff0c34`, `c130755`, `71a2cca`, `a78e73a`, `dc2e337`). Live-used, presumed; the MCP cockpit depends on them.
- **substrate-pull-sync / mirror-to-live / .last-good revert** (08-08). Live-used. It **skips dirty submodules** and does not deploy dev-vessel, which runs from the git tree.
- **bump-submodules.yml** (GitHub Action). It never bumped a pointer, and now fails loudly (`851c472`). Broken on credentials.
- **trace_digest / activity_execution_trace_digest** (07-08). The second is a duplicate dead table.
- **three trace tables** (`activity_execution_traces`, `activity_execution_trace`, `execution`). Legacy aliases were "being archived" on 07-26.
- **federation transport reservation healing** (4 layers). Live-used; "do not add a 5th".

## D. Principles (dated to first appearance in this shard)

- 05-23: the substrate is the source of truth for memory; files are a cache. It has been violated and re-stated at least 3 times since.
- 06-06: walk the four cutover boundaries (proposal-parse, cutover-evidence, intent-emit, host-sync) explicitly; conflating them wastes hours.
- 06-14: `template.metrics` ≠ trace counts, and trace lists are oldest-first. Measure the store, not the summary field.
- 06-16: every bug class gets a detector (`feedback_substrate_self_detection`, recursive). This is law 6, three months earlier.
- 06-17: benign no-op ≠ failure (skip-success). Failures must carry error_message/failure_mode or the posterior is poisoned.
- 06-19: the ground truth for a landing is a pushed substrate-authored commit, not an apply record.
- 06-21: reuse before mint (Key Design Principle #9). This is law 3.
- 06-22: a writer that pins a peer's endpoint cannot learn the peer moved (obsidian `host:27183`), three months before the 09-22 `:8270` restatement.
- 06-25: typecheck ≠ fix. Code cutovers need the reach-gate's orthogonal counterpart (a semantic or behavioral check).
- 06-28: "Just firing will not count" — success is a commit on origin/dev without intervention.
- 06-30: when behaviour contradicts a committed fix, compare the process start time to the file mtime first.
- 07-01: any UPSERT that blindly overwrites on re-emission destroys accumulated learning state; merge-preserve consumer-written counters.
- 07-03: causal discipline. Log the decision, not just the choice; predictions get grading dates.
- 07-04: silent fallback chains are the real enemy. One env gate hid three silent layers.
- 07-04: ground truth is the git-home commit plus deployed source, never dispatch status.
- 07-05: placement follows data locality. Not everything everywhere, and not blanket self-sufficiency.
- 07-07: no goal preprocessing; the agent is a resolver. This is law 13.
- 07-31 / 08-08 (substrate-utils): "run the existing thing with corrected inputs before scoping a build", and "search the repo for the symptom's own vocabulary; check whether the deployed artifact predates HEAD".
- 08-08 (substrate-utils): **"did it actually do anything, or does it only look fine?"** A green or quiet subsystem is not evidence.
- 08-08: a dedup index over operator-touchable storage must treat stored rows as untrusted: "one bad row that throws is an outage".
- 08-10: never collapse *tool failed* into *tool found nothing*, nor *this address failed* into *that host is down*. Dial by hostname. Probe visibility by resolving a shape only that vessel serves.
- 08-10: a blocker classification is a hypothesis; re-probe before reporting.
- 08-10: any vessel process you start inside a spoke registers itself and is mirrored fleet-wide; retract it explicitly.
- 08-06: capacity and spend knobs are the user's decisions; diagnose before changing, and before reverting.
- 08-16: metabob-dashboard is the only dashboard. Do not cite metabob-cloud-dashboard.
- 05-09 (scratch-perspective): two-phase validation (flow, then content). A flow can return 200 while the content is wrong for the decision.

## E. What to keep (from this shard)

- The substrate-utils notes `substrate-vessel-durable-update-path`, `substrate-topology-both-local-containers-are-spokes`, `substrate-submodule-bump-frozen` and `substrate-gap-closing-loop`. They are the most precise deploy and topology facts, and several are still true: dev-vessel runs from the git tree, pull-sync skips dirty submodules, and there are two gap-store paths.
- The devbob `_archive_2026_07_03` is the only record of 06-xx mechanisms (trace retention, forward-model poisoning, surgical gate, ribosome dedup, failed_attempts merge). It should be indexed by problem class, not deleted. The 07-03 concept-db distillation did not carry it.
- The 680-note `/workspace/memory/notes.json` (05-27 → 07-23) and the `pre-op-retire` backup (1,788 notes) on node 1 are the only copies of the system's pre-09-26 memory. **Do not let a retention or cleanup pass touch them.**

## F. Holes for round 3

- 01-30 → 04-22: no memory dir covers it.
- metabob-mcp and metabob-dashboard transcripts (9 files, ~20 MB) were not mined.
- The cause of the 09-23 → 09-26 memory collapse: bracket it with the dev-vessel landings b5ed109, 19ae84e, d4171b1, 4332e38 and dac3c2c and the unit journals.
- Whether any reader consumes `compose_lesson`, `reach_gate_lesson`, or the 07-03 distilled concepts.
- Why `upkeep_stats` stays empty while retention runs (a write-read mismatch candidate).
