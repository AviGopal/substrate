# Track 3: how failures become gaps, measured

Read-only investigation, 2026-10-02 (container clock 09:0x–09:4xZ). Nothing was dispatched, filed, closed or
restarted. Temporary host files were deleted when the run finished.

**Sources and windows. Every number names one of these.**
- **Gap store:** `/workspace/git/super-repo/gaps/gaps.json` (the live store; `WORKSPACE_ROOT` in the env file
  resolves there).
  - 6,878 rows, created 09-18 16:48Z → 10-02 09:26Z. That is the store's whole retained life, about 14 days.
  - **3,372 of the 6,878 (49%) are not gaps.** They are `goal_host_auto_draft` decision records (categories
    `auto_draft_*`), born `closed`, written 09-18 → 09-22, and none after that.
  - Every gap-triple figure below therefore uses the **3,506 non-telemetry rows**.
- **Trace store:** SurrealDB table `execution`. It is the capped store (cap 150,000; 150,067 rows), and its
  window is about 09-25 12Z → 10-02.
  - Run counts come from `execution`.
  - `findings_count` comes from the sibling table `activity_execution_traces`, because only that table carries
    it. The two tables give different run counts for the same template (for example detector-yield-registry-tick:
    135 in `execution`, 210 in `activity_execution_traces`). Each count below names its table.
- **Journals:** goal-host from 09-26 16:26Z (the journal's start) → now.
- **Failure memory:** `/workspace/.goal-host-failure-memory.jsonl`, 2,098 lines, 09-25 → 10-02.
- **Live source:** `/vessels/<vessel>/src`.

---

## 0. The finding in one paragraph

Detectors read a trace as its **envelope**: `status`, `duration_ms`, `task_count`, the `activity_id` prefix, and
`failure_mode.type`, which has three values (`execution_error`, `cascading`, `verifier_negative`). They never
read its **verdict content**.

The verdict is stored as free text in `failure_mode.reason`, typed `execution_error`, the same type as a refused
socket. The one keyed class token the system computes is the `deterministic:<class>` verdict (for example
`edit-intent-no-landed-edit`, `code-investigation-uncited`). It has exactly one reader: the failure-memory
prompt preamble. That preamble deliberately drops the structural classes ("no producer", "missing shapes",
`hollow_walklog_capped`).

So the floor, which writes 0 tasks by construction, was watched by **seven detector families and filed as eight
open gaps in seven different hats** (§3.1). None of them says "the floor used no tools." And none of the roughly
800 deterministic HOLLOW verdicts in the journal window became a gap or a goal (§4).

The pipeline does produce volume:
- ~3,000 gaps in 14 days;
- 52 minted detectors;
- ~4,700 detector runs per week.

But each family keys by **instance**: template id, execution id, goal hash, an invented shape name, a date or a
timestamp. Most families also lack a closer that reads the same signal they filed on. **One detector-born gap in
792 closed `landed_verified`.**

---

## 1. Prior art (read first; what happened last time)

| Prior attempt | What it established | Why it did not hold / status now |
|---|---|---|
| Detector-authoring recursion: `detector_coverage_scan` → `build_signature_detector` → `detect-<class>` (06-13..06-19; "June meta-detectors" in `classes/_mechanisms.json`) | "A recurring bug class with no detector" is itself a gap, and the drafter authors the detector deterministically. | The cluster key is `failure_type::activity_prefix` (`detector-coverage-scan.ts:235-237`), so each "class" is one template. Measured below: 52 `detect-*` activities, 4,668 runs in `execution`, 4 gaps. `_mechanisms.json` already says "mostly per-instance detect-unclass…". **Nothing changed.** |
| Class dedup by volatile-stripped id (`c214385`/`c8be5b1`, 06-14) | Collapse detector floods at write. | `_mechanisms.json`: "Defeated by per-failure/per-goal ids (route-edit-<hash>, recommit-*, …)". Still true: 656 `route-edit-*`, 481 `recommit-*`, 499 `*-narrowed` rows (§2.4). |
| detector-yield registry (c07, `detector-yield-registry.ts`) | Joins gap provenance to outcome and scheduling, so it can name DORMANT and LOW_YIELD detectors. | `_mechanisms.json` lists it "live-used, 41 execs". **New this run:** both of its classifying inputs are blind (§2.5). It ran 135/135 "reached" in `execution` and has emitted 0 `detector-retirement-*` rows. |
| `orphaned_capability_scan` (`dv:1ef83560`, 06-23) | Mines advertised-but-uninvoked capability. | REALIGNMENT §2.1 table: "No retire direction. 5 of 51 closed." agentic-runner 5-history: `META_DENY` exempts `mcpTool`, `activity_search`, `trace_search`, `tool_pattern_search`. **Still in live `orphaned-capability-scan.ts:118-130`.** Coordinator plan step R0. |
| IMPLEMENTED_DORMANT audit (memory 09-16; `raw/memory-1.md`; CANON) | The largest audit class is "built, never fires". | Same mechanism MECHANISM-AUDIT-2026-09-28 calls "decay without detection". Its item 6 ("each self-correction mechanism carries 'fired on real traffic within N'") is unbuilt. §2.5 shows three detectors that fire and read nothing. |
| Class-1 arming guard bug (memory 09-22; `predicateLiteralNotUnique`, `5499f5c`) | A path-join bug read ENOENT as "absent", so every `expected_literal` armed; gaps were born closable. | REALIGNMENT §2.2 "live defects": it "still arms on catch and reads the decoy" path. Of 6,878 rows, 78 carry `expected_literal`. |
| Gameable-metric regression (memory 09-15; `falsifier:none`) | A metric that can be satisfied without fixing anything will be. Prose answers do not make a gap closable. | Today 6,869/6,878 rows carry a `falsifier` field. Among detector-family rows, `none` dominates (missing_capability 881/885, systematic_failure 557/581, every reach-gap, phantom, precondition, novel-failure and runtime-drift row). REALIGNMENT §2.3: 88% of open gaps `falsifier:none` (09-29). |
| Bulk closes (§6.2: 06-14, 09-05, "693 on 09-28") | Hand-completing the loop's work. | Measured: **668** `walk_artifact` closes stamped `closed_by: operator:claude-avi`, all at 2026-09-28T01Z. A further 124 `walk_artifact` closes carry no `closed_by`. Their resolution text: "single-goal demand (697 open capability gaps, 697 distinct shapes, 0 demanded by 2+ goals); reopened by the filer when a second distinct goal needs this shape". **The reopen promise held:** 30 of 30 rows with `demand_count ≥ 2` are `open` again. |
| `missing-verifier-gap.ts` (goal-host) | "The refusal is a detected capability gap, and it was filing nothing." | Only `isQuantitativeRepoQuestion` goals reach it (9 regex families). The open gap `the-missing-verifier-generator-only-mints-quantitative-families` already says so. Measured in §4. |
| REALIGNMENT §2.0b (route-around record + need-keyed counter + encapsulation goal) | The demand signal the system, not the operator, should turn into a goal. | "This is the one entry without a failed predecessor of the same form." Not built. The coordinator plan's slice item **V6** builds the record. §4 measures the absence. |
| REALIGNMENT §2.1 (one evaluator, rows with must-fail controls) and §2.3 (gap write contract) | Consolidate detectors into rows. Refuse placeholders. Abstain-plus-localize. Verify carried fields. | Both are unbuilt, builder (a). This track's asks are written as rows and contract checks for those two organs, not as new detectors (§5). |

---

## 2. The pipeline map

### 2.1 Who can file without an operator

The live source has **80 files that write `substrateGap`** (grep of `substrateGap_write|fileGap|gaps.json|fileCapabilityGap`
across `/vessels/*/src`). They fall into three trigger tiers.

**Tier R — rhythm ticks.** These are boredom- or rhythm-selected `development-vessel:*-tick` templates.

| Detector (file) | Reads | Predicate | Writes (category / id key) | Runs 7d (`execution`) | Gaps in store (14d), open |
|---|---|---|---|---|---|
| `trace_failure_pattern_report` | trace list | repeated failures per template | `systematic_failure` / `systematic-failure-<template>-<first_failed_task_id\|zero>`. **The only family that locates a step.** | (via satisfier) | 47 / 41 open (`systematic-failure-*`) |
| `detector_coverage_scan` → `build_signature_detector` | traces + gap citations | uncited cluster ≥ min_recurrence; key `failure_type::activity_prefix` | `detector_coverage_gap` / `detector-coverage-gap-<type>_<prefix>`; then **mints `detect-<type>_<prefix>` activities** | detector-coverage-audit-tick 86 (`activity_execution_traces`); draft-detector-activity 275 | 8 / 8 open |
| 52 minted `detect-*` (generic `signature_cluster_scan` bound to one prefix) | traces | match on `failure_type` (null for `unclassified_failure`) and the prefix | `systematic_failure` / emit_summary "Repair needed: N× …" | **4,668 runs** (4,416 reached) | **4** (2 × `detect-unclassified_failure_feature_compose`, 2 × `…_mitosis_tick`) |
| `phantom_trace_scan` | trace list, then a single-trace GET | `status=success ∧ task_count=0` | `trace_quality` / `phantom-success-<execution_id>` | — | 10 / 10 open |
| `precondition_rejection_scan` | trace list (no per-candidate confirmation) | `failure ∧ duration < threshold ∧ task_count=0` | `missing_concept` / `precondition-rejection-<template>-<date>` | — | 31 / 31 open |
| `vector_space_orthogonality_audit` | trace vectors | novel failure mode | `novel_failure_mode_detected` / `novel-failure-<template>\|<type>-<ms timestamp>` | — | 13 / 13 open (three ids within 10 s per burst) |
| `orphaned_capability_scan` | registry + invocations, minus `META_DENY` | advertised, never invoked | `orphaned_capability` / `orphaned-capability-<shape>` | orphaned-capability-tick 58 (`activity_execution_traces`, findings 1,560) | 88 / 41 open, 35 rejected |
| `capability_gap_audit` | gap store | — | `missing_capability` | 65, 0 findings (`activity_execution_traces`) | — |
| `self_fact_reconcile` | hard-coded fact table vs working tree | divergence | `self_knowledge` / `self-fact-divergence-<fact>-<site>` (class-2 falsifier) | **584** (582 reached) | 33 / 16 open; reopen_count to 30 |
| `cyclic_flow_scan` | traces | loops | `wasted_cycle` / `wasted-cycle-<template>` | **103 runs, 0 successful** (`activity_execution_traces`) | 4 / 4 open |
| `generative_frontier_gap_tick` | spectral signal | frontier | `missing_capability`, source `substrate_generative` | 136 reached | **0** rows with that source (positive control: `substrate_detected` has 2,442 in the same store) |
| `detector_yield_registry` | gap store + selector snapshot | DORMANT / LOW_YIELD | `detector-retirement-<id>` (only when `emit_retirement_gaps:true`, default false) | 135 reached | **0** |
| about 25 more scans and observers (env-gate, ui-legibility, model-opportunity, resolver-distribution, posterior-consistency, systemd-unit-health, push-health, service-oom, stale-pointer, template-input-lint, trace-outcome-validity, workspace-hygiene, vessel-exercise, responsibility, …) | various | various | own category and prefix | most run 100–140 times, idle | 0–23 each; **0 rows** for decision_without_action, vessel_exercise_zero_coverage, responsibility_misallocation, workspace_pollution, residual_shape_proposal, gate-saturation, service-oom-cascade, stale-pointer |

**Tier W — walk hooks.** These are goal-host in-process: `src/index.ts`, `missing-verifier-gap.ts`.

| Filer | Trigger | Key | Store count (14d) |
|---|---|---|---|
| `fileCapabilityGap` (`index.ts:5880`) | the walk finds no producer for a target shape | **the invented shape name** (`missing_shape`) | 885 rows over 851 distinct names. 794 (90%) have `demand_count = 1`; 35 have `missing_shape = None`. 802 closed (792 `walk_artifact`). |
| `reach-gap-<slug>` (`index.ts:6050`) | a shape is advertised but unreachable from cold | shape slug | 42 / 40 open, all `falsifier:none` |
| `lost-reached-verdict-<reachId>` (`:1204`) | a reached verdict is lost | **execution id** | 3+ open |
| `route-edit-<goalHash>` (`:4695`) | edit-intent goal routed to `feature_compose` | **goal hash** | 656 (the operator's and lane's goals, stamped `source: substrate_detected` or null) |
| `missing-verifier-<family>` | `deterministic:no-oracle-for-goal-class` on a quantitative repo question | family (9 regexes) | **0** |
| failure memory (`index.ts:4278-4362`) | each non-structural HOLLOW | `goal_hash` (+ a lexical `classToken`) | not a gap: a jsonl read only by the next prompt (§4) |

**Tier L — lifecycle and landing events** (development-vessel lane, pull-sync, scripts).
- `feature-compose.ts:3694` files `recommit-<gap>-<failure class>` on a failed compose: 481 rows, nesting up to
  depth 4.
- `gap-to-feature` narrowing files `*-narrowed`: 499 rows.
- `attempt-register` files `unaccounted_landing`: 137, of which 114 are superseded.
- pull-sync files `pull-sync-testgate-*`: 28.
- runtime-drift-tick files `runtime-drift-*`: 14.
- `joint_liveness_detector`: 6, all open, none closable (REALIGNMENT §2.1).

### 2.2 The gap triple, by origin (3,506 non-telemetry rows, 09-18 → 10-02)

**How rows were attributed.**
- **Lane/goal-routed:** `route-edit-*`, `recommit-*`, or category `edit_intent_route`.
- **Human/operator:** source `human_reported`, operator narration/audit, or an operator author.
- **Capability filer:** `kind: capability_gap` or category `missing_capability`.
- **Detector:** a detector source (`substrate_detected`, `walk_flat_pointer`, `joint_liveness_detector`,
  `substrate_self_repair`) or `classification_metadata.detector`, after the three cuts above.

The cuts are needed because `source: substrate_detected` is also stamped on route-edit goals. 10 of the
"substrate_detected `landed_verified`" closes are operator edit goals (§2.3).

| Origin | Rows | Open | Closed | Closed `landed_verified` | Closed by re-measure | Other closes |
|---|---|---|---|---|---|---|
| Detector | 792 | 499 | 58 (+55 `resolved` self-repair timers, 120 superseded, 60 rejected) | **1** (`performance-inefficiency-execution_traces_list`) | 7 `predicate_verified_by_detector`, all self-fact divergences that flap (REALIGNMENT §2.1) | 31 no reason, 10 environment_artifact |
| Capability filer | 883 | 39 | 802 | 1 | 6 `expired_not_redetected`, 3 `producer_now_exists` | **792 `walk_artifact`**, of which 668 are the operator's 09-28 bulk |
| Lane/goal-routed | 1,149 | 1,060 | 76 | 7 | — | 49 `landed_unverifiable` |
| Human/operator | 531 | 427 | 91 | 22 | 8 `predicate_verified_by_operator` | — |
| Unattributed | 151 | 96 | 41 | 8 | — | 10 junk-status rows |

**Latency**, as the median from first detection to close, across all origins:
- `landed_verified`: 1.6 h (n=39; mostly operator-dictated edits);
- `landed_unverifiable`: 109.5 h (n=63);
- `predicate_verified_by_detector`: 45.5 h (n=7);
- `walk_artifact`: 65.6 h (n=792).

**Durability.** 121 rows have `reopen_count ≥ 1`, and 9 have `≥ 14`, topping out at 30. All of those are
`self-fact-divergence-*`, which opens and closes on polarity.

**Junk rows.** 10 rows still carry literal template placeholders in `status`, `source` or `id`, for example
`{{goal.gap.status}}` and `{{substrateGap.source}}`, plus one `status: "Open"`. These are the rows the §2.3
contract would refuse.

### 2.3 "Different hats" (law 7): one need, many ids

- **Lineage forks.** 499 `*-narrowed` and 481 `recommit-*` rows together make 28% of non-telemetry rows.
  - Of the 780 open rows that carry a parent pointer, 63 have a parent that is already closed or superseded.
- **Edit-site concentration.** 1,562 open rows carry an `edit_site`, spread over only 149 files.
  - The top six files hold 861 of them (55%): goal-host `index.ts` 219, discovery `registry.ts` 209,
    `feature-compose.ts` 124, `gap-to-feature.ts` 115, discovery `index.ts` 113, `vessel-mitosis-cutover.ts` 81.
  - On discovery `registry.ts`, 203 of the 209 are `route-edit-*-narrowed` and `recommit-route-edit-*` forks of a
    handful of goals.
- **The floor**, one need, filed in seven hats. All are open, and none names tool use:
  - `systematic-failure-universal-tool-fallback-zero` (09-18)
  - `precondition-rejection-universal-tool-fallback-2026-09-18` and `…-2026-09-30`
  - `detector-coverage-gap-execution_error_universal_tool_fallback` (09-21)
  - `lost-reached-verdict-universal-tool-fallback-ab5a7bb2-…` (09-25)
  - `novel-failure-universal-tool-fallback|execution_error-…` (09-30)
  - `phantom-success-universal-tool-fallback-7a9cef9c-…` (09-30)
  - `wasted-cycle-universal_tool_fallback` (09-30)
- **The dead terminal `obsidian:write_note`**, in at least four hats:
  - `detector-coverage-gap-execution_error_auto_bridge_obsidian_write_note`
  - `detector-coverage-gap-execution_error_learned_composition_problem_detection_to_obsidian_write_n…` (10-01)
  - the operator's `goal-target-inference-proposes-a-terminal-shape-no-producer-serves`
  - the capability filer, which refuses it as "already served" (35 refusals 09-26 → 10-01, output-shapes/3)
- **Capability names.** 885 rows over 851 names (§2.1). The filer keys by the LLM's invented shape name, so
  `final_analysis_report`, `detailed_investigation_report` and `task_execution_report` are three gaps for one
  need. This is the "850 rows / 850 names" fact from the brief, re-measured.

### 2.4 Failure analysis before filing: what a failure is classified as

**Trace classification** (`execution`, `success=false`, 34,620 rows, ~09-25 → 10-02):

| `failure_mode.type` | Reason bucket (regex over `failure_mode.reason`) | Rows |
|---|---|---|
| none | — | 14,533. **12,923 are `auth_resolve_v1` telemetry**, 1,510 `feature_compose`, 100 `vessel_mitosis_cutover`. Excluding auth: **1,610 genuinely unclassified.** |
| `execution_error` | transport (fetch failed, timeout, 5xx, invalid URL) | 11,088 |
| `execution_error` | no reason | 3,091 |
| `execution_error` | other (degraded outputs 601, `structuredError` 282, chain-depth refusals 205, "requires shape X but no matching impulses" ≈ 300, …) | 2,019 |
| `execution_error` | **floor judge verdict** (`metadata.floor = true`; the reason is the judge's HOLLOW text) | 1,573 |
| `execution_error` | structural ("is not registered", "no producer") | 651 |
| `execution_error` | input binding | 597 |
| `cascading` | mostly transport | 910 |
| `verifier_negative` | — | 11 |

What follows from the table:
- **HOLLOW, structural and transport all share `type: execution_error`.** The distinguishing fact lives only in
  prose (`reason`), and no detector parses that prose. `detector_coverage_scan` keys on `type`, so everything
  above collapses to `execution_error_<template>` or `unclassified_failure_<template>`.
- **No step locator.** Only `trace_failure_pattern_report` carries `first_failed_task_id`, and it writes `zero`
  when the trace has no tasks. That is the floor's case and the case of every resolver-direct row.
- **A class keyed by need exists in exactly one place:** the goal-host `deterministic:<class>` verdict. Its
  journal distribution, 09-26 16:26Z → now:

  | Class | HOLLOW lines |
  |---|---|
  | `edit-intent-no-landed-edit` | 369 |
  | `code-investigation-uncited` | 221 |
  | `hollow_walklog_capped` | 145 |
  | `code-investigation-citation-unverified` | ~75 |
  | `no-output` | 24 |

  Of 2,892 lines containing "HOLLOW", 868 are deterministic. The token is stored in failure memory as
  `deterministic: true` alongside the reason text, and is not a field anything else reads.

**False positives**, from the predicates read against what the rows are:
- **phantom-success: at least 6 of 10 open rows are false positives.**
  - 5 are `auth_resolve_v1` telemetry rows, which have 0 tasks by design.
  - 1 is a `universal-tool-fallback` floor row, which has 0 tasks by construction.
  - The other 4 (3 `learned-composition-orphaned-capability-scan-to-substrategap`, 1 substrate-health
    composite) are unverified.
  - Keyed by execution id, so every occurrence is a new gap.
- **precondition-rejection: 31 rows, keyed `<template>-<date>`, so the same template re-files daily.**
  - The predicate requires `duration < threshold ∧ task_count = 0`, and the scan does not confirm each candidate.
    That is unlike `phantom_trace_scan`, whose header documents that the list endpoint reports `task_count = 0`
    for every post-migration-118 trace.
  - Positive control: in `execution`, 1,843/1,843 `satisfier:project_thread_scan` rows carry exactly 1 task and
    record `duration_ms: 0`. So "0 ms, 0 tasks" is a recording artifact for satisfiers that did run.
  - The 13 `satisfier:*` rows and the 4 floor/`feature_compose` rows in this family (17 of 31) are therefore
    false positives under the scan's own stated pattern (F25 pre-flight rejection).
- **novel-failure: 13 rows over about 5 bursts.** The id carries a millisecond timestamp, so one novel mode
  files three gaps within 10 s.
- **Capability filer: false capabilities.** `lifecycle:execution:succeeded` (a lifecycle event, demanded by 8
  goals), `None` (35 rows), and 876 one-off nouns.
- **`falsifier`: present on 6,869 rows but empty in substance.** `none` is the value on 881/885 capability rows,
  557/581 detector `systematic_failure` rows, and every `reach-gap`, phantom, precondition, novel-failure,
  orphaned-capability and runtime-drift row. Under `admitActionableGaps` (falsifier required), these detector
  families are **non-actionable at birth**, so detection does not reach the lane.

### 2.5 Detectors that run and read nothing ("silent skip = pass")

- **`detector_yield_registry`: both classifying joins are blind.**
  - Its selector path defaults to `WORKSPACE_ROOT/state/boredom-selector-state.json`, which is
    `/workspace/git/super-repo/state/…`. **That file does not exist.** The boredom vessel writes
    `/workspace/state/boredom-selector-state.json`, and that one records `picks: 0` for all 713 templates
    (generated 10-02 05:02Z), so even the right path would read DORMANT for everything.
  - Its LOW_YIELD branch keys on `closed_reason === "churned_unlandable"`, which occurs **0 times** in the store.
  - It ran 135/135 "reached" (`execution`) and emits no retirement gaps.
- **The 52 minted `detect-*` activities:** 4,668 runs in `execution` (33 are `unclassified_failure_<template>`,
  including one detector for a detector). `findings_count` is 0 on every row in `activity_execution_traces`.
  They yielded 4 gaps.
- **`generative_frontier_gap_tick`:** 136 reached runs, 0 `substrate_generative` rows.
- **`cyclic_flow_scan_tick`:** 103 runs, 0 successful (`activity_execution_traces`). It is "seeded as an activity
  but unroutable" per its own open gap.
- **`detect-uninterpolated_placeholder_in_activity_id`:** 115 runs, 0 findings, while 10 placeholder rows sit in
  the gap store. It watches activity ids, not gap rows.
- **Routine ticks fill the gradable store.** `gap-to-scenario-bridge-tick` wrote **23,169** rows into
  `execution` in 7 days, all `reached:true`. That is 15% of the capped trace store, which is the store detectors
  read. It is the 10-01 standing rule ("routine code → counters") still unapplied.

---

## 3. Classes the system should have caught and did not

| Missed class | Detector that watches that place | Why it did not fire | What would have caught it (row / key) |
|---|---|---|---|
| **Floor `tools=0/0` on 908/908 verdicts** (agentic-floor APPROACH §1) | `phantom_trace_scan`, `precondition_rejection_scan`, `detector_coverage_scan`, `trace_failure_pattern_report`, `vector_space_orthogonality_audit`, `cyclic_flow_scan`, reach-loss (§2.3: 7 families, 8 gaps) | They read the envelope (0 tasks, `execution_error`) and misread the row as phantom, pre-flight or novel. **No detector reads `metadata.tools_total`, `tools_ok` or `grounded_reads`.** A grep of development-vessel, activity-api and boredom `src` finds 0 files. Positive control on the same grep address: `information_yield` is in 8 files. The counter is also structurally 0 (open gap `floor-tools-counter-reads-zero-…`, human-reported 09-30). | A §2.1 row "floor rows with `tools_total = 0` ≤ X% over N", with the sandboxed line-count control (agentic-floor step 1) as its positive control. The row keys on the **field**, not the template. The 8 hat-gaps fold into the existing `floor-tools-counter-reads-zero-…` (plan R0 already says so). |
| **Dead `mcpTool` bridge** (agentic-runner 1, 5-history) | `orphaned_capability_scan` | **Exempted.** `META_DENY` still lists `mcpTool`, `activity_search`, `trace_search` and `tool_pattern_search` (live `:124-130`). A denylist entry reads as a consumer. | Plan **R0**, unchanged. Add: a new `META_DENY` entry counts as a recurrence (5-history). |
| **Unservable deliverable terminal `obsidian:write_note`** (output-shapes 3) | capability filer; `detector_coverage_scan`; reach-gap | Filer: "already served" because it checks the inference vocabulary, which contains the dead shape (blind input, 35 refusals). Coverage scan: fired twice on 10-01, keyed by template prefix, prescribing "author a detector". The structural reason `Resolver 'obsidian:write_note' is not registered` (651 structural rows in §2.4) has no reader. | Plan **V1** (`/deliverable-shapes` gate) plus the §2.1 row "deliverable terminals have an advertiser" (output-shapes APPROACH), with must-fail `obsidian:write_note` today. |
| **Untraced `GPT-5.md` write** by floor run `27c1c600` (agentic-floor A) | `workspace_hygiene_observer` | **Watches the wrong place.** It counts `/vessels/*-mitosis-*` directories only. Nothing watches the substrate's super-repo clone. **Measured now:** `GPT-5.md` (14 B, 09-30 01:47) is still there. `git status` in the clone shows **59 untracked root files** (09-22 → 09-30) and 1,711 untracked paths under `validation/`. The `ALLOWED_TOPLEVEL_DIRS` hook fires only on commit, and nothing commits these. | A §2.1 row "untracked paths in the substrate clone outside an allowlist = 0", with must-fail `GPT-5.md` present today. Plan step 0 (containment) stops new writes. This row detects the class. |
| **Live surface proxy missing a route** (`GET /api/gaps/:id`; human-surface 2-surface-reads) | runtime-drift-tick | **Did fire, in the wrong hat.** `runtime-drift-human-surface-vessel` (open since 09-22) says "routes/proxy.ts differs … repair not armed (set RUNTIME_DRIFT_REPAIR=1 to arm)". That is an env-gated repair (law 1). It reports file divergence, not the lost capability. human-surface is outside the authorable set (memory 09-22), so no lane can act on it. | A §2.1 copy-vs-authority row whose authority is `git show origin/dev:<path>` (§2.1 item 3). The finding names the route the authority serves and the live copy lacks. Its arming is a policy shape, not `RUNTIME_DRIFT_REPAIR`. |
| **CSRF-forwarding `/api/resolve`** (human-surface APPROACH §0.1; REALIGNMENT §9.0) | none | **No detector exists for route authentication or forwarding.** All five 10-01 security gaps are `human_reported`. | A §9.0 route-auth evaluator row: every resolve/write route validates the caller; a forwarding route keeps a read-only boundary. Must-fail: `/api/resolve` forwards a `goalDispatchAsync` body today. |
| **The resolve-URL joiner class** ("fetch() URL is invalid") | none by signature; the gap `rawresolve-concatenates-…` was hand-written 09-22 | It *was* fixed: **6,853** `execution` rows with that reason, the last at **09-28 13:05Z**, 0 since 10-01. But the gap is still open 10 days later. **No closer reads a signature's disappearance**, so a fix that works is indistinguishable from one that did not. | Signature-absent closing (ask 3): the gap carries `(normalized reason, activity scope)` from the traces it cites, and closes `signature_absent` after a window with 0 matches, conditional on the same query matching before the fix (positive control). |

---

## 4. "Wrongness is a goal seed": measured

| Generator the system should have | Exists? | Measured (window) |
|---|---|---|
| Deterministic mismatch → repair goal for the named class | **No.** The class token goes to `failure memory` → prompt preamble only. | **0** gap rows contain `edit-intent-no-landed-edit`, `code-investigation-uncited`, `hollow_walklog_capped`, `citation-unverified` or `no-oracle-for-goal-class`. Against that, the journal holds about 800 deterministic HOLLOW lines (09-26 → 10-02). Positive control through the same address (gap-store substring search): `semantic_reject` matches 65+ rows. |
| Missing-verifier generator | Yes, quantitative-repo questions only | **0** `missing-verifier-*` rows in the store. **0** `no-oracle-for-goal-class` lines in the journal window. It cannot fire on the 369 + 221 classes above. |
| Hollow cluster over goals sharing surface form → parse + command + oracle | No | Failure memory holds 1,926 failure records over **555** distinct goal hashes (09-25 → 10-02). 54 hashes failed ≥ 5 times. The top three are 137 × "reconcile trace store", 99 × learning-loop-selftest, and 88 × capability census. Each record re-paraphrases the judge, so no class key aggregates them. **Structural reasons are excluded by design** (`index.ts:4302` regex: no producer, missing shapes, capability gap filed, `hollow_walklog_capped`, unreachable, timed out). |
| Route-around counter → encapsulation goal (REALIGNMENT §2.0b) | No | 0 rows match `route-around`, `routed_around` or `encapsulat` as a generator, except one closed unrelated row. The walk's local `missingTargets` is never emitted (plan V6). |
| Detector authoring from uncovered clusters | Yes (`detector_coverage_scan` → `build_signature_detector`) | It is the **one generator that does fire**, and it is keyed by instance: 8 coverage gaps → 52 `detect-*` activities → 4,668 runs → 4 gaps. It turns "wrongness" into more detectors of the same instance, not into a repair goal. |
| Failed compose → retry gap | Yes (`recommit-<gap>-<class>`) | 481 rows; 578 `systematic_failure` rows are lane self-failures (`semantic_reject` 65 + 33 narrowed, `anchor_not_found` 38 + 22, `verify_failed` 31 + 20, …). These *are* class-keyed (the compose failure class) **but also instance-keyed by parent gap**, so each class recurs under every parent. No row aggregates "anchor_not_found across N gaps" into one repair of the drafter. |

**Net.** The system mints *gaps* and *detectors* from wrongness. It does not mint *repair goals keyed by class*.
The only class-keyed verdict it computes is consumed as prompt text, and only for the same `goal_hash`.

---

## 5. Asks to the coordinator

All asks are proposals, not edits. Builder labels follow the brief: (a) operator bootstrap on autonomyScope-excluded
paths; (b) dispatched goal. Each is placed against the plan of record (agentic-runner APPROACH §4 at `8bf102d5`)
and REALIGNMENT.

**A1 — Class-keyed `failure_mode` with a step locator. NEW** (feeds §2.1 and §2.3).
- **Seam:** where verdicts are written into `failure_mode`, which is goal-host `index.ts` (the HOLLOW and floor
  write sites), plus the activity-api trace write.
- **Change:** add `failure_mode.class`, the existing `deterministic:<class>` token, or `transport` / `structural:<reason-kind>` / `judged_hollow` / `abstain`. Add `failure_mode.step`, the task id, or `floor` / `walk` when there are no tasks.
- **Deterministic gate:** for a row with `type = execution_error`, `class` is required. Free text stays in `reason`.
- **Builder:** (a), goal-host `index.ts`. activity-api is (b).
- **Controls:**
  - positive: a dispatched `edit-intent` goal that does not land yields `class = edit-intent-no-landed-edit`;
  - must-fail: today's 1,573 floor rows show `execution_error` with no class.
- **Overlaps:** agentic-floor step 1 (instrument the floor). Do it in the same landing.

**A2 — Deterministic-verdict → class-gap generator. NEW** (extends §2.0b's counter organ; no new service).
- **Seam:** a development-vessel scan outside the exclusion set.
- **Reads:** failure memory, after goal-host serves it as a shape. Today it is a local jsonl, which is a law 1/10
  issue. Serving it is (a), a one-line read route.
- **Counts:** by `(class, edit_site-or-shape)` across distinct `goal_hash`es.
- **Files:** **one** gap per class over a threshold held as a policy shape. Its id is `class-<token>`, its
  `edit_site` is the verdict's code site, and its falsifier is "the class's rate over N dispatches is below X".
- **Builder:** (a) for exposing the memory; (b) for the scan.
- **Controls:**
  - positive: `edit-intent-no-landed-edit` (369 in 6 days) files one gap;
  - must-fail: a single-goal class (one hash) files nothing.
- **Overlaps:** V6 supplies the route-around input to the same counter. Build one counter with two inputs.

**A3 — Signature-absent closer. NEW** (a §2.1 re-measure close, applied to trace signatures).
- **Gate at write** (§2.3 contract): a trace-derived gap carries `trace_signature = {normalized reason, activity
  scope}` from its cited rows.
- **Closer:** in `gap_lifecycle_scan`, close as `signature_absent` (never `landed_verified`) after W hours with 0
  matches, **and only if** the same query matched ≥ k rows in the W hours before the cited fix.
- **Builder:** (a). `gap-lifecycle-scan` and `substrate-gap` are excluded.
- **Controls:**
  - positive: `rawresolve-concatenates-…` closes (6,853 matches until 09-28 13:05Z, 0 since);
  - must-fail: a gap whose query never matched (address fault) does **not** close.

**A4 — Clone-hygiene row. NEW as a row; plan step 0 is the containment.**
- **Row:** §2.1 "untracked paths in `/workspace/git/super-repo` outside an allowlist = 0".
- **Authority:** `git status --porcelain` on the clone.
- **Builder:** (a), since the evaluator is self-fact-reconcile.
- **Controls:**
  - must-fail today: `GPT-5.md` plus 58 other root files;
  - positive: a sandboxed probe file is flagged within one tick.
- **Retire:** `workspace_hygiene_observer`'s mitosis-dir count becomes a `variant_of` row, not a parallel
  instrument.

**A5 — Re-key or retire the per-instance detector mint. Consolidation of an existing organ (REALIGNMENT §2.0/§2.1 item 1).**
- **Seam:** `detector-coverage-scan.ts:235-237`.
- **Change:** the cluster key becomes `(failure_mode.class, failure_mode.step-kind)` from A1, not
  `failure_type::activity_prefix`. Stop `build_signature_detector` from minting while the class is
  `unclassified_failure`.
- **Retire:** the 52 `detect-*` activities via `detector_yield_registry`, after A6.
- **Builder:** (b).
- **Controls:**
  - must-fail: today's `detect-unclassified_failure_development_vessel_detect_unclassified_failure_…` (a
    detector of a detector) cannot be minted;
  - positive: one coverage gap for "floor rows, no tools".

**A6 — Unblind `detector_yield_registry`. Consolidation of an existing organ.**
- **Changes:**
  - the selector path resolves through the boredom vessel's shape, not a filesystem default;
  - the LOW_YIELD branch reads closure reasons that exist (`walk_artifact`, `environment_artifact`, rejected);
  - `emit_retirement_gaps` becomes a policy shape (law 1), not a pointer default.
- **Builder:** (b).
- **Controls:**
  - positive: the minted `detect-*` family classifies LOW_YIELD (4 gaps from 4,668 runs);
  - must-fail: a fixture detector whose gaps landed classifies PRODUCTIVE.

**A7 — False-positive guards on the envelope detectors.** Folds into plan R0 / agentic-floor step 2.
- **phantom and precondition scans:** exclude rows that have 0 tasks by construction (`metadata.floor`, auth
  telemetry, resolver-direct satisfiers). `precondition_rejection_scan` gets the same per-candidate confirmation
  `phantom_trace_scan` has.
- **Ids:** drop the date and timestamp from `precondition-rejection-*` and `novel-failure-*` ids (dedup by class).
- **Builder:** (b).
- **Controls:**
  - must-fail: the 6 phantom and 17 precondition false positives listed in §2.4;
  - positive: a fixture engine pre-flight rejection still files.

**A8 — Already in plan or REALIGNMENT; evidence attached here, no new item.**
- `META_DENY` (R0).
- `/deliverable-shapes` gate (V1).
- Route-around record (V6).
- Placeholder and `falsifier:none` rows at write (§2.3: 10 junk rows; detector families born non-actionable).
- Route-auth evaluator row (§9.0).
- Runtime-drift arming as a policy shape (law 1; `_mechanisms.json` "runtime-drift repair: duplicate").
- Telemetry out of the gap store and routine ticks out of `execution`: the 3,372 auto-draft rows, which stopped
  09-22, and the 23,169 `gap-to-scenario-bridge-tick` rows. This is the 10-01 standing rule.

**Measurement note for the gap triple.** Until A1 and A3 exist, detector close rate cannot be told apart from
operator bulk closure. Today that is 1/792 detector-born `landed_verified` and 668/883 capability rows closed by
one operator action. Report it split by origin, as in §2.2, never pooled.
