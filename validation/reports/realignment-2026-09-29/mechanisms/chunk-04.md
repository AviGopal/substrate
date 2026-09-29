# Mechanisms, chunk 04: development-vessel (65 records, 44 after dedupe)

Written 2026-09-29. Input: `classes/_mech_chunks/04.json`.

**How the evidence was gathered (read-only).**
- The source is the live clone `substrate-live:/workspace/git/vessels/development-vessel`. HEAD is `f451e42` ("apply route-edit-d5990852 via mitosis cutover", 09-29).
- Trace counts come from `execution_trace_content` (30-day store, 513k rows), filtered on `tasks.resolver_id CONTAINS '<id>'`.
- **Warning about that filter.** Filtering on a top-level `resolver_id` returns 0 rows for everything, including `feature_compose`. That is a false zero; the field lives inside `tasks[]`. Every "0 traces" below comes from the corrected `tasks.resolver_id` filter. "0 traces" means none in the 30-day window, and only for the resolver id named. Queries for `feature_compose`, mitosis, `concept_select_for_prompt` and `coverage_tick` timed out; their counts come from `raw/live-resolvers.md`.
- Other sources: `raw/live-resolvers.md`, `raw/live-activities.md`, `raw/timers-readers.md`, `raw/git-devvessel-2.md` and `raw/node2-runtime.md`.

**Two findings that change what the collector records say:**
- `variant_promote` is **not** a fossil. The record from 08-03 said "no implementation", but it is now implemented at `src/resolvers/variant-promote.ts`, driven by `seed/template-promote-tick.ts`, and has 297 ok traces from 09-07 to 09-29.
- `goal_summary` is **not** uninvoked. It has 24 ok traces from 09-18 to 09-29, even though the gap `orphaned-capability-goal_summary` has been open since 09-26.

## Verdicts

### A. Landing path: draft, gate, cut over (the one reliable lander; keep it and consolidate the gates)

| # | Mechanism (records merged) | Verdict | Live evidence |
|---|---|---|---|
| A1 | **feature_compose edit-intent path** (19) | keep-general | 924 tasks in 30 days; 382 ok / 1,567 fail in 5 days (20 %). `feature-compose.ts` has 525 commits, the last on 09-29 (`f451e42`). It is the only path that has produced autonomous landings. |
| A2 | **exact-edit path `synthesizeVerbatimEditOps` / [fc-exact]** (60) | keep-general | `feature-compose.ts` (`f70160f`). Live since 09-27; 3 byte-equal falsifier passes. It is the "pre-validated goal" route in memory 09-24/09-27. |
| A3 | **targetFileOnDisk: resolve the clone first** (17) | keep-general, merged into A1 | `20a668b`, `a0ff3d3`, `13841a4` and `1d4ac1c` are at HEAD. It fixed the "gate reads a stale super-repo copy" class. |
| A4 | **parkedLanding resume** (16) | keep-general, merged into A1 | `873fd81`, `6ab8271`. **Hazard:** `6ab8271` silently reverted `a0ff3d3` (09-24); the fix was re-applied in `7994841`. A resume must diff against the parent plus its own edits. |
| A5 | **emit-API gates** (18) | keep-specific | `feature-compose.ts:1749-1836`. They refuse invented emit APIs and wrong resolve paths. Still open: `feature-compose.ts:538` joins `${v.endpoint}${v.resolve_endpoint}` unguarded, the same resolve-URL joiner class as goal-host `asResolvePath`. |
| A6 | **patch_with_tools** (28, 29) | merge-into A1/A2 | 2 traces in 30 days (09-22, 09-26); it produced hollow stage-only results again and again. It has no worktree isolation (it edits `/vessels`). Byte-anchored multi-hunk editing now exists deterministically as A2. Keep its file as the escalation fallback, but let Thompson retire it through the registry rather than maintaining a second lander. |
| A7 | **Vacuous-edit gate** (0, 1, 36) | keep-general | `src/vacuous-edit.ts` has 19 commits, the last `ed313f2` on 09-25. It is used by feature_compose and `patch-with-tools.ts:33/:1438`. Autonomous lanes edited it 6 times, and `ed313f2`/`4c154b9` *relaxed* it. Known misses: dead imports and 2-declaration chains. Known false positives: added logs. |
| A8 | **Semantic gate `verifyPatchAddressesGap`, including refuters and the spec-exact short-circuit** (3, 30) | keep-general, **fix fail-open** | Present in 3 source files (feature_compose and pwt `:1460-1498`, `21da981`). It fails open, so a PASS is unmeasured, and on some paths it runs after landing (08-17). Pwt refuters have confabulated dialect facts (memory 09-22). |
| A9 | **staticEvaluate landing gate** (8) | keep-general | `vessel-mitosis-evaluate.ts` (`44bcffd`, `a4a4102`; last commit `70d2a00` on 09-25). Autonomous lanes weakened it (`550f2f7`, `54b7762`), so it needs protected-file status. |
| A10 | **surqlBreakingFieldRefusal** (7) | keep-specific | `vessel-mitosis-evaluate.ts`. `54b7762` wedged it from 09-16 to 09-22, and `1a18944` restored it. Rule from memory: run the gate on the unmodified file first. |
| A11 | **Vessel mitosis start/evaluate/cutover/tick** (4, 5, 57) | keep-general | 77k tasks in 30 days (`vessel_mitosis_evaluate` 25,863; `_cutover` 24,715; `mitosis_pending_observer` 27,055). Every "via mitosis cutover" commit comes from here. Residue: 11 `/vessels/*mitosis*` dirs on node 1 and 4 on node 2. Its copies run through untraced shell calls. |
| A12 | **Drafter-corruption gate inside cutover** (32) | merge-into A11 | `vessel-mitosis-cutover.ts` (113 commits, last `3c66b29` on 09-28). 0 false positives (`93b18ba`), but it can be deleted without anything noticing (08-03). |
| A13 | **selfRestartAlreadyOwed** (6) | keep-specific | `46d252c`. 4 coalescings, and 1 on node 2 in 72 h. |
| A14 | **compose-workspace worktree isolation** (14) | keep-general | `compose-workspace.ts` (`8ec501b`; last commit `6de3011` on 09-07). It is not a registered shape (it is a helper). 3 concurrent landings were observed. A6 does not use it. |
| A15 | **decentralized compose ownership** (53) | keep-general, **move its config into a shape** | `gap-to-feature.ts:1705,4533` ("not owned here"). 93 owner=compose2 picks and 129 exclusions in 24 h. `VESSEL_ID`/`VESSEL_ADVERTISE_ENDPOINT` live in a boot-transient drop-in that a recreate drops (law 1, law 11). |

### B. Gap closing and verification (gap-to-feature)

| # | Mechanism | Verdict | Live evidence |
|---|---|---|---|
| B1 | **verifyGapConditionAsync + sweepPendingLandVerifications** (64) | keep-general | Present in 5 source files; landed_verified went from 50 to 60. It is starved because about 98 % of gaps carry no predicate. It shares its target with B6. |
| B2 | **landedCommitVerdict** (20) | keep-general, merged into B1 | `gap-to-feature.ts:2461`, 5 call sites; it replaced 3 duplicated blocks. |
| B3 | **isNonAttemptComposeResult** (62) | keep-general | Present at HEAD. BUSY/draining results do not bump failed_attempts; "development-vessel is draining" refused 852 tasks in 5 days. |
| B4 | **shouldNarrowForChronicFailure** (63) | keep-specific | Present, with the `da86fbb` test. `a57dc30` notes that a narrowed child is a verbatim duplicate. |
| B5 | **escalation_disposition_apply + human_exemption_attempts_remaining** (59) | revive-general | **0 traces in 30 days** as a resolver id (registered but unseen, per `live-resolvers.md`). Human answers never arrive: escalations still post to the replaced stateful-ui `:8270` (318 new panels 09-22→28; 2,873 lost on node 2). The recurring class is "the seal has no escape". Revive it by reading the human-surface answer shape through discovery. |
| B6 | **gap_falsify pass + pre-admission decomposition** (42) | keep-general | `gap-lifecycle-scan.ts:730,832` writes `predicate_source: gap_falsify:<rule>` so each rule can be graded. 6 decompositions in 24 h, mostly "no valid step". It is the only producer of the predicates B1 starves for. |
| B7 | **capability-gap demand ledger + producer_count** (47) | keep-general | `4d3381c` (dev) and `4361247` (goal-host); 693 walk-artifact gaps closed. |
| B8 | **discardedLandingReport sweep** (35) | keep-specific | `services/gap-drain-observer.ts:349`. Not measured in this pass whether it has run (used_now unknown). |
| B9 | **verifyGoalReached reach gate** (48) | keep-general | Present in 5 dev-vessel files plus goal-host. It is called in-process (no resolver id). It is the `reached` verdict. |
| B10 | **autonomous_pick lease (maintenanceLease)** (46) | keep-general | Present in 9 files. It gates only *new* picks; generalize it into a TTL quarantine shape (openspec #59). |

### C. Gap lifecycle / law-7 metrics (gap-lifecycle-scan)

| # | Mechanism | Verdict | Live evidence |
|---|---|---|---|
| C1 | **gap_lifecycle_scan itself** (host of C2–C5) | keep-general | 413 traces, 409 ok, from 09-12 to 09-29 05:14. |
| C2 | **funnel-history.jsonl gap triple** (44, 45) | broken | `gap-lifecycle-scan.ts:661-742`. median_latency_ms=0 and expired=0 on all 47 runs. There are two series; the old one was orphaned on 08-08 and its line 1 is a TS code block. The law-7 readout reads zero, so gap latency is unmeasured. |
| C3 | **autoCloseStaleGaps expiry closer** (41) | revive-general (as *disposition*, not TTL) | `gap-lifecycle-scan.ts:189/:434`, wired from `seed/gap-lifecycle-tick.ts:26` (`autoClose:true`). expired=0 on every run while stale_open rose to 1,434. In earlier eras it produced 79 % of closes, which is a gameable metric. It is needed as the "not worth closing" leg of learned disposition. |
| C4 | **dispatchScenario reprobe** (61) | broken | `gap-lifecycle-scan.ts:254-276` resolves `import.meta.dir/../../validation/failure-modes/scenarios`, which is `/vessels/development-vessel/validation/...` and **does not exist**. The 4,573 scenarios are at `/workspace/validation/failure-modes/scenarios`. So it always returns `scenario-not-found`, which is treated as not reproduced (a silent skip reads as a pass). Fix: resolve the path through `workspace-roots`. |
| C5 | **landability_predictions.log** (43) | fossil | Writer only (`gap-lifecycle-scan.ts:406`); no reader anywhere. The file has 74,149 lines at `/workspace/git/super-repo/gaps/`. Archive: stop the write and emit predictions as trace fields (counterfactual at decision time, law 12). |

### D. Memory and priors

| # | Mechanism | Verdict | Live evidence |
|---|---|---|---|
| D1 | **memoryNote store + session hooks** (26, 27, 39) | broken | Heavily used: 1,358 trace rows. The store is broken: node 1 `notes.json` holds **59 notes, oldest 09-26**; node 2 holds **3** (1,236 wiped on 09-26). `memory-note.ts:81` swallows any read error to `[]`, and the next save then overwrites the store. The shared `.tmp` path is at `:89`. There is one flat file per node with no p2p reach, which conflicts with "absence in one place is not absence". Pre-09-26 history exists only in `*.bak` files. Same class as the missing `snapshot-state` (E7). |
| D2 | **concept_select_for_prompt + SessionStart hook** (37) | keep-general | 747 trace rows. It is the drafter's read-at-use lesson channel (the teaching law). |
| D3 | **concept-bridge observer** (56) | broken (on node 2) | `observers/concept-bridge-observer.ts:196,214` uses `CONCEPT_DB_ENDPOINT` = `env(...,"http://127.0.0.1:8260")` (`config.ts:41`), so on node 2 (concept-db masked) it logs about 1,300 connection failures a day. Fix: resolve concept-db by shape through discovery. |

### E. Learning loop / selection

| # | Mechanism | Verdict | Live evidence |
|---|---|---|---|
| E1 | **validateEvidenceGate + variant_promote** (2, 40) | keep-general | `resolvers/variant-promote.ts` + `seed/template-promote-tick.ts`; `variant_promote` has 297 ok traces from 09-07 to 09-29. Record 40 ("fossil, no implementation") is **superseded**. Doc drift: docs place the gate in activity-api `impulses.ts`. |
| E2 | **ribosome extraction** (50) | keep-general, **needs retirement grading** | `ribosome-extract` 1,456/1,459 ok in 5 days. The chains it mints are ungraded: 65 live rows have 20 or more runs and 0 ok (`codereadresult→concept-write` 5,464/0). Law-4 mechanism. |
| E3 | **variant minting write, `applyExtraction` gate** (51) | revive-general | ias-executor `templates/lifecycle/ribosome-extract.json:31` defaults it to `false` ("observe-only first canary"); `engine.ts:269-277` notes that the lifecycle passes no variables. "Canary until calibrated" never flipped. The promote leg (E1) is live, but birth by extraction is gated off. |
| E4 | **REUSE_BEFORE_MINT chokepoint** (12, 13) | keep-general, **move gate to a shape** | `activity-create-variant.ts:779-800` (`activity_create_variant` 9 traces). Its mode comes from `process.env.REUSE_BEFORE_MINT` (default `enforce`), an env gate (law 1). |
| E5 | **rankSize + recent_count tie-break + paging** (58) | keep-specific | `activity-lifecycle-audit.ts`; `activity_lifecycle_audit` 508 traces, 507 ok (09-11 to 09-29). |
| E6 | **learning_policy + learning_policy_writeback** (24) | broken (dormant) | 0 traces in 30 days. Its last write (09-16) tuned TD_LAMBDA/YIELD_FLOOR on zero evidence. Do not revive it until a writeback is gated by E1-style evidence. |
| E7 | **snapshot-state / restore-state** (54) | fossil (never built) | 0 hits in source. The *need* (off-host continuity) is real and belongs to D1. |
| E8 | **consumption-as-verification** (52) | revive-general | Principle verified 07-20; the activity and its credit leg were never minted. Recurring class: `hollow_write` (a field nothing reads, 09-15) and `write→read` severed joints (`joint-liveness` gaps open since 09-27/28). |

### F. Detectors / observers / ticks

| # | Mechanism | Verdict | Live evidence |
|---|---|---|---|
| F1 | **docs-align family** (docs_align_tick/scan/bridge, doc_drift_fix) (15) | broken | `docs_align_tick` has 30 ok traces (09-24→29), while scan, bridge and drift_fix have 0. `docs-align-tick.ts:578` builds `existing_paths = walkScripts(scriptsDir)`, **scripts/ only**, so the scan flags every other path, producing false gaps and 0 closes. `doc_drift_fix` is routed but never registered. 8 resolvers form a duplicate family (`git-devvessel-2.md`). Law-9 loop. |
| F2 | **rhythm-reality-sync** (31) | broken | 0 traces in 30 days. `329fc5c` (09-26) rewrote the whole rhythm body from a stale read, which lost concurrent α/β settlements. Its poolImpulse write was landed 3 times (`282b78d`, `2b9c520`, `cc51104`). The fix needs a merge-write (fenced), not a whole-body write. |
| F3 | **trace_store_health_observer** (34) | broken | 222 ok traces (09-13→09-28). It checks only row_count against the cap (the store sits at 149,790/150,000), so it cannot see 89 % garbage. It mints the id `db_performance_slow_queries_<hour>` (`trace-store-health-observer.ts:90`) naming a template that does not exist. It succeeds while blind. |
| F4 | **ui_legibility_scan / ui-legibility-audit-tick** (38) | broken | 27 trace rows, only 2 ok, last on 09-26. No `uiLegibilityReport` producer as of 09-28. |
| F5 | **systemLoadReport / db_contention_observer / load-aware boredom gate** (9) | revive-general | `resolvers/system-load-report.ts`; 0 traces for either. `db_contention_observer` is routed but not registered. Recurring class: event-loop-block kills (memory 09-14), loadavg forensics, and value-per-cost selection needs a cost signal. Its static thresholds from 09-01 were calibrated to miss. |
| F6 | **goal_summary** (21) | keep-specific | 24 ok traces (09-18→09-29 02:31). The orphaned-capability gap is stale and should be closed as a false positive. |
| F7 | **lambda1_inequality_ok proxy** (25) | broken | `learning-transfer-report.ts:235` compares `density >= fraction` on incomparable scales; 1 trace (09-25). |
| F8 | **probe-reachable-unlearned / coverage-tick / draft-gap-closing-activity / draft-spec-from-gap** (55) | fossil | 0 traces in 30 days for probe, draft_gap and draft_spec (coverage_tick timed out). They remain only as registry rows plus organic compose variants; in May they were a misroute sink. |
| F9 | **intervention_evaluate / interventionRefused** (22, 23) | fossil (dormant S3 primitive) | Routed at `impulses.ts:636`, registered in `config.ts:417`, listed by `orphaned-capability-scan.ts:106`; 0 traces in 30 days; 6 records in 2 split JSON stores. Re-derive it from evidence when S3 probes begin; do not hand-revive. |
| F10 | **complete-vessel-scaffold** (33) | fossil | `seed/complete-vessel-scaffold.ts` last touched 07-12 (`bbf0e09`, 2 commits). Nested resolve_endpoint, no systemVessel; every sibling scaffold resolver has 0 traces. |
| F11 | **decomposition primitives: orderChangePlan / scoreSpliceability / parity-gate / seam-extraction** (10, 11) | revive-general | `src/maintenance/*`. `orderChangePlan` **is** imported by `resolvers/change-series-tick.ts:55` (registered `change_series_tick`, `config.ts:146`), which has 0 traces in 30 days. parity-gate and seam-extraction are reached only by `scripts/run-seam-extraction.ts`, which nothing invokes. Last change `4aef10b` (08-29). Recurring class: "multi-file asks drop parts silently" (CLAUDE.md one-file rule) and 16k-line `goal-host index.ts` edits. |
| F12 | **BoundedBusSink** (49) | duplicate-of → shared package | The class is defined separately in `goal-host-vessel/src/index.ts` and `boredom-vessel/src/index.ts`; dev-vessel only references it in `config.ts:581`. Its cap is env-tuned. |

## Duplicates collapsed
- Records 0, 1 and 36 are A7; 3 and 30 are A8; 4, 5 and 57 are A11; 32 is merged into A11.
- 10 and 11 are F11; 12 and 13 are E4; 22 and 23 are F9.
- 26, 27 and 39 are D1; 44 and 45 are C2; 2 and 40 are E1; 28 and 29 are A6.

## Cross-cutting pattern (why these recur)
1. **Gates get weakened by the lanes they gate.** A7, A9, A10 and A12 were each loosened or deleted by autonomous commits (`ed313f2`, `550f2f7`, `54b7762`), with nothing detecting it. A protected-gate list read at mitosis evaluate time would cover all four.
2. **Fixed paths and defaults instead of discovery.** C4 (`import.meta.dir` path), D3 (`127.0.0.1:8260`), A15 (drop-in env), E4 (env mode), A5 (URL joiner), and B5 (escalations pinned to `:8270`). The same class shows up six times; the fix belongs at the seam (workspace-roots / discovery), not at each call site.
3. **Success while blind.** F3 (222 ok), F1 (30 ok, 0 closes), C4 (always "not reproduced"), C2 (latency 0) and A8 (fail-open PASS) all emit healthy traces while measuring nothing. The trace status is not evidence; each needs a positive control through the same address.
4. **Per-node state with no p2p reach.** D1 (59 vs 3 notes) and A11 residue dirs. These violate "absence in one place is not absence".

## Discoverability for kept/revived
- **Registered shapes** (discoverable via `registry_query`): A1, A11, B1–B7, C1, D1, D2, E1, E2, E4, E5 and F6.
- **In-process helpers** with no shape: A3, A4, A7–A10, A12–A14, B8–B10. They become discoverable through concept-db concepts naming their seam (e.g. "landing gate stack at vessel-mitosis-evaluate"), recalled by `concept_select_for_prompt` at drafter prompt-build.
- **Revive candidates**:
  - B5: register a read of the human-surface answer shape.
  - C3: make it a disposition activity, not a TTL.
  - E3: flip per template on measured quality.
  - E8: mint as an activity.
  - F5: register `db_contention_observer`.
  - F11: give it a goal-host multi-file entry that dispatches `change_series_tick`.

## Fossil archive location
- `landability_predictions.log`: move to `validation/reports/realignment-2026-09-29/fossils/` (1 sample) and stop the writer.
- `complete-vessel-scaffold`, the F8 ticks and `intervention_evaluate`: keep in git history. Deregister the shapes and record each as a `fossil` concept in concept-db with the last hash, so a future mint finds it first (reuse before mint).
