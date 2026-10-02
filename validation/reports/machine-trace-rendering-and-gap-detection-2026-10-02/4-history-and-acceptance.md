# Track 4: history of the ribosome's trace input and of autonomous gap detection, and acceptance criteria

2026-10-02, read-only. Nothing was dispatched, written, filed, closed, restarted or committed to produce this file. My temp files were deleted: host `/tmp/t4q.sh`, `/tmp/t4q.sql`, `/tmp/t4-realign.md`, `/tmp/t4-checkins.md`, `/tmp/t4-rx.json`; container `/tmp/t4q.sh`, `/tmp/t4q.sql`. A pre-existing `/tmp/t4/` dir (09-28) is not mine and was left alone.

**What this builds on, cited rather than redone:**
- `realignment-2026-09-29/agentic-runner/5-history.md` §1b–1d: the minibob → ias-executor port, row by row;
- `realignment-2026-09-29/agentic-floor/C-extraction-and-reuse.md`: the ribosome at HEAD as of 10-01;
- `realignment-2026-09-29/dossiers/composition-crystallization.md` §1 and §7;
- `realignment-2026-09-29/dossiers/gap-content.md` §2, §6 and §8;
- `realignment-2026-09-29/raw/gap-history.md`: eight store discontinuities;
- REALIGNMENT at `origin/dev`: §2.0b, §2.1, §2.3 and §7;
- `self-development-program-2026-09-25/CHECKINS.md` at `origin/dev` (360 lines; its last row is 10-02 03:29). The local working-tree copy is older (337 lines).

**Sources I read myself:**
- git `origin/dev` of ias-executor-ts, activity-api, development-vessel, goal-host-vessel and concept-db, plus the super-repo;
- the live gap store `substrate-live:/workspace/git/super-repo/gaps/gaps.json`: 6,878 rows, mtime 10-02 09:31Z, earliest `created_at` 09-18 (the store was reborn then);
- SurrealDB `activity` (learned-* rows), read 10-02 about 09:40Z;
- the goal-host and development-vessel journals on node 1. Both begin **09-26**: goal-host 16:26Z, development-vessel 16:26Z.

Operator memory files are a derived cache (law 10). Claims taken only from one are marked **(memory)**.

**Labelling:**
- Every "Substrate Autonomous" count here is subject to the CHECKINS 09-30 17:15 **C4 correction**: "six of today's 'verified autonomous' landings were operator-dictated."
- Before 09-30, git and the intent ledger could not tell operator exact-edits apart from derived edits. CHECKINS 09-29 17:10 found that 15 lane commits authored "Substrate Autonomous" were operator edits to excluded paths.

---

## 0. Summary

1. **The ribosome's input has changed form once, and every later fix has patched that one form.**
   - **03-24 → 04-27:** minibob extracted *deterministically* from per-step `ExecutedTask`/`ToolCall` records. From 04-07 those records also carried a declared and an actual output shape per step.
   - **04-27 (`mb:360e0de`):** extraction moved to an LLM meta-activity, `ribosome-extract.json`, which reads a **content-stripped trace signature** (`executionTraceWithSignatures`, born `aa:003f477` 04-24). The template's own prompt says the signature "does NOT carry the output content".
   - Since then about 13 repair episodes each restored one field or one address on that signature path: config, `impulses_by_id`, args, output_shapes, input_shapes, view/table, status vocabulary. None changed who reads the trace or what form it is read in.
   - Edges were never carried, in any era: minibob wrote `inputState.impulses: []`.
   - Live today, the 17 `learned-*` rows minted since 09-29:
     - 0 carry `dependencies` or `inputImpulses`;
     - **0 have executed at all**;
     - two are a new near-duplicate pair: `learned-auto-bridge-uiPanel-write` and `learned-auto-bridge-uipanel-write`, minted 41 s apart from one source execution (`exec_gdusu0cl`).
2. **Gap detection began as prose and has been repaired downstream of the write, not at it.** The landmarks:
   - `substrateGap` shape (`dv:fc3f2eaa` 05-27);
   - meta-detector flood (06-13);
   - class dedup (06-14);
   - `evidence_resolve` (07-07);
   - close-oracle on measurement (08-14);
   - birth predicate, reverted (08-30/31);
   - `classifyFalsifier` (09-01);
   - `directed` flag (09-22/23);
   - `self_fact_reconcile` (09-23);
   - `autonomyScope` `require_falsifier_classes` (09-27);
   - demand ledger (09-28);
   - §7 step-2 journal-pattern detectors (09-29);
   - **birth evaluation of class-2 checks (`dv:eebecd02`, live 10-01 01:14Z).** This is the first mechanism that sits *at* the write seam with the right source of truth.
   - Since i3 went live, 170 gaps were born, 53 of them substrate-detected. Only 1 of those 53 carries a birth verdict, and 45 carry `falsifier:none` (§1B).
3. **No instance on record closes the whole loop.** The loop is: failure observed → class detected → gap filed with a machine-checkable falsifier → repair → landed → verified at the consumer → durable for 14 days. §2 tests every candidate:
   - **Every class-2 `landed_verified` close since 09-28 (10 rows) traces to an operator filing, an operator check-first test, or an operator-dictated edit.**
   - The detector-side closes (`predicate_verified_by_detector`, 12 rows) are condition-gone or vacuous closes, not landings. Five of them have since reopened 25–28 times and are **open today**.
   - The most durable system-originated landing (`gh:4e5d37f`, 08-06, still at HEAD after 57 days) had no class key and no machine falsifier, and its verification was the operator's.
4. **Acceptance criteria (§4)** extend the existing retire conditions; they do not restate them. They are composition-crystallization §7 and gap-content §8, plus REALIGNMENT §7 steps 2, 3 and 5. What is new is listed in §4.

---

## 1. Dated timeline

Repo prefixes: `mb:` minibob, `ie:` ias-executor-ts, `rv:` ribosome-vessel, `gh:` goal-host-vessel, `dv:` development-vessel, `aa:` activity-api, `cdb:` concept-db. Unprefixed hashes are super-repo.

### 1A. The ribosome's input representation

| Era / date | What the ribosome read, and how it was rendered | Intent | Measured effect | What regressed, and why |
|---|---|---|---|---|
| **03-24** `mb:95adca0` | `ImprovisationTrace` unified into `ActivityExecution`: `templateId = improvised-<slug>`, steps as `ExecutedTask` with `ToolCall`s. "Everything is recorded for template extraction" (`improviser.ts` header) | Make the improviser's raw steps first-class trace rows | Trace rows existed (5-history §1b) | — |
| **03-27** `e5b04851` (microplastic) | A **deterministic** `TraceExtractor`: "task boundary detection based on tool transitions", "variable identification with confidence scoring", "input/output schema inference from tool calls" | Gain of function: successful runs become templates | 95 unit tests. Never ran in the substrate; microplastic abandoned after March (crystallization dossier §1) | Fossil |
| **04-04 → 04-14** `mb:87f101e`, `mb:225ab6f` (04-07), `mb:476da58` | Imperative `extractTemplateFromImprovisation`. From 04-07 every step **declares** `expected_output_shape` and `step_purpose` before acting, and the actual shape is validated after: "directly convertible to activity templates" | Templates with real I/O schemas | 04-14: **3 of 3 novel goals → 3 templates registered**, each with **1 task** (`b64c705e`). The template format had `task_steps[].dependencies` | **The richest machine rendering the system has ever had** (5-history: "No later runner records a declared-vs-actual shape per step"). Still no edges: every step wrote `inputState.impulses: []` (`improviser.ts:1438-1443`) |
| **04-24** `aa:003f477` | `executionTraceWithSignatures`, a read shape that serves *signatures* (task ids, resolver, shapes, counts) instead of content | One read seam for trace structure | — | It becomes the only input the ribosome reads. Content is excluded by design |
| **04-27** `mb:360e0de` | The ribosome becomes the lifecycle meta-activity `ribosome-extract.json`: an LLM `assess_quality` and `synthesize_template` over the signature. `metadata.supersedes` lists 3 removed sites, including `improviser-resolver.ts:204-228 success extraction (removed)` | Centralize extraction, make it a graded activity (law 2) | `applyExtraction` defaulted false, so writes were 0 by construction. Disabled **64/98 days** (5-history: to `gh:337d223` 06-30 / `rv:5f96ba4` 08-03) | **The pivot.** Extraction moved from deterministic over steps to an LLM over a content-free signature. From here on the ribosome sees structure without output, and the prompt tells it so: "the trace signature you see here does NOT carry the output content, so do not re-litigate content quality from it" (`ie:ribosome-extract.json`, `assess_quality`) |
| **05-06 → 05-24** `mb:8b918d2`, `57d74520` | The improviser lost its last caller on 05-06. minibob was removed 05-24 ("centralization", 27.3.g) | — | `improvise_health.ribosome_activation_rate` read **0** on all 4 reports with improvise traces (05-15..05-23) | The per-step shape record was dropped and never ported (5-history §1d). **05-24 → 06-22: nothing in the substrate extracted anything** (`gh:15620e7`) |
| **05-24** `3a3ef840` ribosome-vessel | Rendering: WS `task.*` events, counted by a drain timer; dispatches `ribosome-extract` | A vessel owner | 0 executions "EVER" until 06-22, because it dispatched to the trace store, not an executor | WS counter vs durable census (later `572cd6c`) |
| **06-02 → 07-14** `ie:213f0da`, `ie:2029936`, `ie:fdcd0ec` (deterministic id, 06-25), `ie:140d1fa` (output_shapes, 06-30), `ie:fef0bd6`/`c927b5a` (07-13), `ie:f174656`…`0d2b890` (07-14) | Prompt and transport rewrites of the same LLM-over-signature form | Make mints writable, deduped, discoverable | Composite mints became discoverable on 06-30 (`d105e1ae`) | The id rule `learned-<parent-slug>` is enforced **only by the prompt** (C §3.1). Live breakage: `learned-satisfier-substrategy` for `satisfier:substrateGap`, and today's `uiPanel`/`uipanel` pair |
| **06-22 / 06-30** `gh:15620e7`, `892c342b`, `gh:337d223` | **Second rendering layer.** goal-host `mintReachedTrace` plus `buildCompositeTraceFromChain` synthesize a trace from the walk chain (`resolverId = chain[i]`, positional), then feed the same signature path | Mint from reached walks | First goal-host path able to write since 04-27 | Two owners with different gates from then on (C §3.1: 5 of 24 ungrounded reaches written anyway) |
| **07-21 / 07-23** `gh:8d969b4`, `gh:411417b` | Gate on the reach verdict before rendering | No hollow templates | Hollow templates fell from 374 to 2. Only 23 of 62,968 success rows were eligible (crystallization §1) | Goal-host owner only; ribosome-vessel bypasses it (C §3.2) |
| **07-22** `aa:2f61532`; **07-31** `aa:3ccc65f`; **08-13** `aa:fc559be`; **08-16/17** `ie:a56fe27`, `ie:5030377`, `ie:f71bb56`; **08-17** `aa:93029ad` | The signature regains fields one at a time: tasks from `execution` rather than the blob copy; per-task config; `impulses_by_id` hydrated for satisfier reaches; rolled-up `input_shapes`; config verbatim; the resolver's actual call arguments | Make extracted composites re-executable | 08-13 "autonomous minting demonstrated" was retracted. On 08-21, `11859d57` found the ribosome's whole output was 2 templates. 436 `learned-*` by 08-25 | Each was a field restored on the content-free form. **Edges were never added to the synthesis schema** (C §3.3: 0 of 515) |
| **09-22 07:39Z** | The point lookup reads `v_paradigm_execution_traces`, now a plain 2-row table | — | 1,437 of 1,440 runs in 7 d were hollow `[success, skipped×6]`; 0 mints for 7 days (crystallization §4) | Root cause 1: "the extractor reads its evidence through an address that other work keeps moving" |
| **09-29 16:21/16:27Z** `aa:c546ec9`, `aa:784a162` | Point lookup re-pointed: `FROM type::thing("execution", $id)` | Revive extraction | First 7/7 run at 16:39:52Z (`exec_g8wmvbqs`). 145 full runs in 7 d (C §3.2) | **An address fix, not a rendering change. Operator-directed** under the substrate identity (CHECKINS 09-29 16:45 and 17:10: "none of these is autonomy evidence"). The c546ec9→784a162 same-day correction chain was needed because the first form exceeded the 8 s fetch timeout. qa recorded a cross-run binding leak and a same-id overwrite by 4 concurrent runs (CHECKINS 09-29 17:05) |
| **Live, 10-02 ~09:40Z** | — | — | `learned-*` = **528** rows. **17 created since 09-29:** 0 with non-null `tasks[].dependencies` or `inputImpulses`, and **`total_executions = 0` on all 17**. 3 have 2 tasks; 14 have 1 | Two new near-duplicates (`uiPanel`/`uipanel`, same source exec, 41 s apart) and a `learned-learned-*` recursion row. None reused, so the §7.2 retire item "reuse beyond the instance" is unmet |

**Reading of the timeline.**
- Two representations have existed:
  - (i) a raw step record with declared and actual shapes, read deterministically, March–April, never in the substrate;
  - (ii) a content-free structural signature read by an LLM, 04-27 → now.
- Every intervention since 04-27 accepted (ii) and fixed its plumbing. The crystallization dossier counts about 13 "never minted" episodes.
- Neither representation ever carried the data-flow edges, the chain's output content, or the failed steps (C §7 items 3, 5 and 11).

### 1B. Autonomous gap detection

| Date | Event | Intent | Measured effect | What regressed, and why |
|---|---|---|---|---|
| 05-23/24 | Validator narration gaps, `validation/gaps/gap-001..008.md` (hand-written by an agent) | Name failure classes | gap-003 (failure without failure mode) ×12; gap-007 (hollow completion) ×6 | Fossil after 05-24 (gap-history §1) |
| **05-27** `dv:fc3f2eaa` | `substrateGap` shape primitive (inv-031) | One shaped write seam | — | The write has no content contract, which has been true ever since (gap-content §3 root 1) |
| 06-13 `14ec0de1` | Four meta-detectors ("self-detection of session fix classes") | System files its own classes | **4,522 gaps in about 2 days**; 9 closed | The first detector flood |
| 06-14 `dv:c8be5b16` | Dedup by CLASS (volatile-stripped id) | Stop floods | — | Id-keyed. Later floods mint new ids per event (gap-history §4.6). The 8-hex rule was lost in `ca53600` (09-14) and never relanded |
| 06-18 `dv:adf37a05` | "Orthogonal failure-transfer across similar traces" | Failure lessons transfer | — | — |
| 06-23 `dv:1ef83560` | `orphaned-capability-scan` with `META_DENY` | Find advertised-but-unused capability | 108 of 220 rows on 07-22 | The denylist exempts `mcpTool`/`activity_search`/`trace_search`/`tool_pattern_search`, so the detector is told not to see the orphaned bridge (5-history §1c) |
| 07-03/04 `dv:7969b5c8`, `dv:e6de357e` | `compose_lesson` concepts: feature-compose writes `concept_create_write` with `source_type: compose_lesson` and reads it back by `conceptSearch` at prompt build (`feature-compose.ts:3593, :3728, :3838` at `8b48805f`) | Lessons read at use time (the teaching law) | — | The lesson body is `COMPOSE_LESSON_GUIDANCE[cls]`, a **static per-class string** (`:3730`). The write carries no trace content and no step, so the lesson is the class label plus canned guidance |
| **07-07** `dv:a9faf96b`, `dv:ae5a7f9e` (substrate-authored) | `evidence_resolve` on gaps: a shape plus a field the close sweep re-measures | Machine-checkable closure | — | The form later proven right (`614de014`, 09-10, object form). Applied per detector |
| 07-22 | Store reborn (220 rows) | — | — | Second discontinuity of eight |
| 07-29 | Landing-quality audit, 12 of 57 autonomous commits: **83% negative value** (10/12) (memory) | — | 2 substantive (`d5b8968`, `9b2cbdc`) | Gates read the diff; hollow write-only edits pass |
| 07-30 `dv:76f44caa` | `admitActionableGaps`, the first admission gate | Stop unactionable picks | missing_capability 213 → 40 | The first of about 12 downstream compensators (gap-content §2) |
| **08-14** `dv:980135a5` | Close-oracle gates closure on **measurement, not provenance** | `landed_verified` means measured | — | Measurement only where the gap carries an `evidence_resolve` |
| **08-30 → 08-31** `be26a6b`/`196e755`, revert `8a5223c` | Closure predicate at birth | Every gap checkable | **Reverted in 1 day** | It derived the predicate from the post-fix tree, so it "could never read absent". Withdrawn, not reworked (gap-content §6 #6) |
| **09-01** `dv:ddb34cb8`, `dv:2c48c6c9` | `classifyFalsifier`: the store holds "can this gap ever close?" (class1/class2/none/unresolvable) | Make closability a fact | 97.6% `none` on 09-02 → 1,622 open `none` on 09-29 | An honest classifier of prose. It does not change supply |
| 09-05 → 09-18 | Store loses 97% (09-09), then is rebuilt (09-18). Only 256 of 3,548 ids survive, and **0 real operator gaps** | — | — | Durability (law 7) became unmeasurable across the rebuild (gap-history §1) |
| 09-15 `dv:d9131e6`/`5499f5c` | Class-1 arming guard | Refuse a literal already present | **Never fired**: the ENOENT path join reads as absent (memory 09-22) | Fail-open gate |
| **09-22** `gh:9e23455`, `gh:64ce0ac` (operator bypass) | Failure memory keyed by `goal_hash` → `priorVerdictFeedback`; FAILURE-RECALL | The next dispatch knows why the last one was hollow | Live: `FAILURE-RECALL — 0 prior hollow verdict(s) for goal_hash=8eaa2408 + 3 near-miss` (node 1, 09-29 16:16:48) | Prompt-only. It is a per-goal recall, not a class detector |
| 09-22/23 `112e194` (memory) | `directed` flag carried into gap-to-feature | Separate operator and autonomous work | — | An undirected hand-off is a silent WITHHELD (memory 09-28). The `author` field is absent until 09-30 |
| **09-23** `dv:983ca925` | `self_fact_reconcile` v1: detector-filed class-2 gaps, closed on re-measure | One standing expectation evaluator (later REALIGNMENT §2.1) | 7 `predicate_verified_by_detector` closes (live store) | **Polarity inverted until 09-27** (`nonzero_field` read as health; CHECKINS 09-27 13:15). **Node 2 (0 rows) closed node 1's findings** until 09-29 ("the cause of reopen_count 23-26", CHECKINS 09-29 09:00) |
| 09-27 `d7ec192` | `autonomyScope.require_falsifier_classes` | Admit only class1/class2 | 2,343 → 9 admitted | Correct guard; it exposed the supply |
| 09-27 → 28 | Contained autonomy: 8 landings, 0 kept (gap-content §2) | — | `b585a03` was FABRICATE-TO-SATISFY. `a198907` was hollow and **certified landed_verified by the sweep** | — |
| 09-28 `gh:4361247`, `dv:4d3381c`, `dv:36b82b8` | Demand ledger: file a capability gap only on a second distinct demand | Stop the capability-name flood | 50 of 51 capability gaps closed at birth as `walk_artifact` (dossier §4) | Scoped to one generator. The confabulating generator (target inference) is untouched |
| 09-28 `70254535` (09-27) | Joint-liveness filed `severed-joint-ribosome-extraction` | Detect a severed extraction joint | Detected 6 days after the 09-22 severance | No close-on-recovery. Still open after the 09-29 revival (C §0.1) |
| **09-29** `0f6cc4e`, rows `bb38ac6f` | §7 step-2 `journal_pattern` rows in `self_fact_reconcile` (sig_count_query_fails, pull_sync_test_gate_blind, fixture_template_in_live_store) | Detectors with must-fail controls | Filed 3 at 17:22Z; every row's canary found | Windowed journal counts **close by window expiry** (below) |
| **10-01 01:14Z** `dv:eebecd02`, `b1a9ade3` | **i3: birth evaluation of class-2 checks at the `substrateGap_write` seam** (present/absent/unknown; absent or unknown is not admissible) | Inverted or born-closable checks never reach the lane | Live 10-02: 18 gaps carry `predicate_birth_verdict`: present 14, absent 4, all 4 absent superseded. The 4 absent rows are older children judged at 03:19Z. Of the **170** born since 01:14Z, **53 are substrate_detected**: falsifier `none` 45, class1 4, class2 1. **Only 1 of the 53 is birth-judged** (`self-fact-divergence-gap-birth-verdicts-supply-backlog-rose`). 9 of the 13 present-judged rows born since then have no source or are human_reported (operator filings) | **The first write-seam mechanism with the right source of truth** (gap-content §6 pattern: "16 of 18 act after birth"). It judges only class2 checks the filer attached. It does not give prose filers a check |

**Detector families since i3** (substrate_detected births since 10-01 01:14Z, grouped by id prefix): `recommit-*` 7, `db_performance_slow_queries_*` 3, `route-edit` 2, `detector-coverage-gap-execution_error_*` 3, `orphaned-capability-metricSample*` 2, and singletons (`pull-sync-test-regression-*`, `goal_host_inconsistent_direction-*`, `reach-gap-*`, …). They are mostly `falsifier:none`. The lineage and timer families named in gap-content §4 are still the bulk of supply.

**Placeholder rows are live.** A `jq` over `.classification_metadata|keys` fails on a row whose `classification_metadata` is the string `"{{goal.gap..."`. **9 rows** have a non-object `classification_metadata`. This is the `{{…}}` class (gap-content §1 E; REALIGNMENT §2.3 refusal list), still present 10-02.

---

## 2. Did the system ever close the loop end to end on its own?

**The stages:**
- (1) failure observed in traces;
- (2) class detected and keyed;
- (3) gap filed with a machine-checkable falsifier;
- (4) repair goal;
- (5) landed;
- (6) verified at the consumer;
- (7) durable for 14 days.

"Sys" = the system did it. "Op" = the operator did it or dictated it.

**Denominators.**
- Live store: 6,878 rows (reborn 09-18).
- Closed with a measured or landing reason: `landed_verified` 39 and `predicate_verified_by_detector` 7, so **46**. Plus 5 open rows whose recorded `closed_reason` is `predicate_verified_by_detector`, i.e. reopened after a detector close.
- Of the 46: 10 class2 with `close_basis: absent`, all on or after 09-28; 7 detector closes; 1 class1 with `close_basis: absent` (09-22, `the-compose-lane-lands-under-nine-percent…`); the remaining 28 `unresolvable`/`none`, with `close_basis` `absent` (09-19/20, before the class-2 machinery) or `operator_exercised_falsifier` (09-23/24).
- Earlier stores are gone (gap-history §1), so pre-09-18 instances come from git and memory.

| Instance | (1) observed | (2) class keyed | (3) machine falsifier | (4) repair | (5) landed | (6) verified at consumer | (7) 14 d | Verdict |
|---|---|---|---|---|---|---|---|---|
| `gh:4e5d37f` 08-06 (memory): `resolver_schema` read `content` vs `body` | Sys (auto-draft dispatch) | No (one instance) | **No.** Its own check was a grep that "can never return anything else" | Sys | Sys, pushed | **Op** (resolver_schema probe) | **Yes**: `cc = sj?.content ?? sj?.body` is at `gh:index.ts:7785` at HEAD, 57 d | The most durable system-originated landing. Fails (2), (3), (6) |
| `dv:04775a7` 08-09 (memory): autoClose default | **Op** filed | — | No (`landed_verified` was provenance-keyed then) | Sys | Sys, 13 min | Op | Yes (`const autoClose = p.autoClose === true` at HEAD) | Fails (1)–(3), (6) |
| `bafd83d` 08-14 (memory) | Sys gap | — | No | Sys | Sys | — | — | **Inert** rename; the gap re-composed |
| `gh:776391a` 09-02 (memory) | Sys | — | No | Sys | Sys, pushed, 829 tests | — | — | **Dead code**: `exports.substrateGap.emit` in an ESM module. feature-compose warned "TARGET HAS NO TEST FILE" and nothing gated on it |
| `self-fact-divergence-*` (7 detector closes 09-23 → 10-01) | Sys | Sys (fact + key) | **Sys (class2)** | Some decomposed, e.g. fixture-template step-2 `aa:a782ec1` | Not causal | Sys re-measure | **No.** 5 sibling rows are open today after 25–28 reopens | Closes are **condition-gone or vacuous**, not landings. 09-24/09-26 closes happened under inverted polarity and node 2's 0-row closes. The fixture-template parent closed 09-30 12:04, **two hours before** its step landed (14:04; CHECKINS 09-30 14:37 calls `a782ec1` hollow), because its 24 h journal window aged out after the operator's env isolation `fe52c974`. The pull-sync row closed 10-01 the same way |
| `gh:5ca51be` 09-28 (`resolve-url-walk-path-sites-7457-15128`) | Op (operator-scoped) | — | Sys class2 (`trace_failure_pattern_report`, "URL is invalid") | Sys draft (directed) | Sys | **Sys** (sweep re-measure after restart, `close_basis: absent`) | 0 "URL is invalid" lines in goal-host since 09-29 (node 1 journal); **4 days** | First close on the system's own measurement (memory 09-28). Fails (1)–(2): directed, operator-filed |
| `aa:235dae8` 09-29 (sigCountQuery) | Sys row (`sig_count_query_fails`) | Sys | Sys class2 | Sys | Sys | **Sys closed it as fixed** | — | **Regression**: the query became non-terminating; operator reverted `e65dab2` (CHECKINS 09-29 18:05). This is the one instance where (1)–(5) were all system-side, and (6) was wrong |
| `aa:be0ee7a` 09-29 (expired-JWT test) | Op survey | — | Sys class2 `test_suite` | Sys derived | Sys | Sys | 3 d | Operator-filed (survey on the user's request). The C4 status was not re-examined |
| `aa:1bc78f8` 09-30 (execution-traces index) | Sys detector (`performance-inefficiency-execution_traces_list`, filed 09-18) | Sys | **Op-attached** test check (09-29) | **Op-dictated** fix_hint, "matches byte for byte" | Sys identity | Op (p90 8 s → 2 s) | 2 d | The only substrate-detected row in the set. Reclassified C4 (`author_basis`) |
| `aa:9d34415`, `dv:3fa81f7`, `aa:3f62a22` 09-30 | Op | — | Op check-first | **Op-dictated** (C4) | Sys identity | Sys sweep | 2 d | Excluded from autonomy per `author_basis` |
| `aa:5bd2d5b` 10-01 (conservation route deleted by autonomous `53292c9`) | Op | — | Op check-first `aa:ed4b82a` | **Sys derived** (directed) | Sys | Sys (`close_basis: absent`; birth verdict present) | 1 d | The coordinator's "Verified autonomous landings: 1". Consumer output is hollow (`{"invariants":0}`; reads `metadata.findings_count`, which nothing writes, CHECKINS 10-01 17:30) |
| `aa:a5e52db` 10-02 (shape_producer_inventory) | Op | — | Op check-first `aa:7c5e80a` (10-01) | Sys derived (`directed: true`) | Sys | Sys sweep 07:28Z | 0 d | Same pattern as 5bd2d5b |
| `aa:5ac23fc` 10-02 (tuning-param backoff) | Op | — | Op check-first `aa:01635c0` | Sys derived; the earlier attempt was correctly semantic-rejected | Sys | Sys sweep 08:00Z | 0 d | Same pattern |

**Autonomous landing counts (the denominators behind the table).**
- git `origin/dev` since 09-29, authored "Substrate Autonomous": activity-api **23**, development-vessel **22**, goal-host **3**. This identity covers operator exact-edits, dictated edits and derived edits alike. Before 09-30 nothing in git or the node-local intent ledger records `author` (CHECKINS 09-29 17:10), so these counts cannot be split.
- The coordinator's trend: 09-30 16:29 "12h trend: 14 autonomous, 8 closed with evidence, 2 reverts". 09-30 21:29 "9 autonomous (the verified 6 are all operator-dictated under C4; 0 derived-edit verified)". 10-01 17:30 through 10-02 03:29: "Verified autonomous landings: 1 (5bd2d5b)". That one landing has an operator filing and an operator check.
- From the gap store: 10 class-2 `landed_verified` closes since 09-28. **0** of them have both a non-operator filing and a non-operator check.

**Verdict: no instance fills all seven columns.** The record splits into two disjoint halves.

- **Detection half (stages 1–3) is system-side only for `self_fact_reconcile` rows and a few timer detectors.** Those never produce a causal landing. When they close, they close because the condition went away, the window aged out, or a node with no rows read "0".
- **Landing half (stages 4–6) is system-side only when an operator supplied stages 1–3** (filing plus a check-first test) **and** the gap is `directed`.
- The only time both halves were system-side (`235dae8`, 09-29), stage 6 certified a regression.

**What made the near-misses succeed.**
1. A **check that runs**: a `test_suite` with `requested_not_passing`, or a `trace_failure_pattern_report` with `reason_contains`. It was attached at birth and red on the parent (`dv:d2686b7` op7 enforces "own check must be red on the parent").
2. A **non-excluded edit site**. activity-api accounts for 8 of the 10 class2 closes.
3. Re-measure **after the serving node restarted onto the sha** (memory 09-28 seam 4; CHECKINS 09-29 20:50).

**What made the rest fail:**
- the filer supplies prose (89% `none`, gap-content §4);
- detector predicates measure a symptom window rather than a defect, so they close on expiry;
- polarity and node-locality bugs in the very evaluator meant to close them;
- gates that read the diff and never run it (`776391a`);
- the excluded-path set covering most lane-core edit sites (CHECKINS 10-01 03:29);
- store rebirths that erase recurrence.

---

## 3. Governing reasons (quoted)

1. **Extraction has been patched by address, never re-contracted.** "Each fix re-pointed one reader at the current address of one signal. None made the extractor own its inputs as a contract" (composition-crystallization §3). The 09-29 revival was the same kind of fix (an address in `execution-trace-with-signatures.ts`).
2. **The ribosome is told it is blind to content.** "the trace signature you see here does NOT carry the output content, so do not re-litigate content quality from it. Judge only STRUCTURAL disqualifiers: zero or one task …" (`ie:ribosome-extract.json`, `assess_quality`). The synthesis schema has no `dependencies` field (C §3.1).
3. **Edges were never part of any rendering.** "The improviser's steps never recorded edges (`inputState.impulses: []`). So 'restore' is partly wrong: edges were never built, even then" (agentic-runner/APPROACH.md item 3).
4. **The port dropped the per-step shape record.** "This is the closest the system has come to 'every step feeds the shape mechanism'. No later runner records a declared-vs-actual shape per step" (5-history, 04-07 row).
5. **Gap repair acts after birth.** "16 of 18 act after birth. The one at birth (#6) used the wrong source of truth. The one that used the right source (#9) was never generalized" (gap-content §6).
6. **Mandatory fields get fabricated.** "Mandatory fields get fabricated, so the fields are verified, not just required" (REALIGNMENT §2.3).
7. **System-side verification was inverted.** "The closure sweep reads `evidence_resolve.nonzero_field` as a HEALTH field (0 = defect, >0 = fixed); self_fact_reconcile writes `nonzero_field: divergence_count`, a DEFECT count … an auto-revert built on it would revert real fixes and keep regressions" (CHECKINS 09-27 13:15).
8. **Gates read diffs, not effects.** "every gate below this point READS the diff; only a test RUNS it. A FAVORABLE verdict here means the change was reviewed, never executed" (feature-compose log during `776391a`, memory 09-02).
9. **Autonomy was not attributable.** "CORRECTION (CANON C4): six of today's 'verified autonomous' landings were operator-dictated. The derived-edit streak is 0, not 1" (CHECKINS 09-30 17:15).
10. **The interventions repeat a pattern.** "built at a site, not the shared seam; validated once, with no standing caller or rhythm" (CHECKINS 09-30 23:29, quoting the false-verification dossier).
11. **Durability is unmeasurable across store rebirths.** "Every discontinuity reset the law-7 gap triple. Latency and durability cannot be computed across a store that is reborn every 4–6 weeks" (gap-history §1).

---

## 4. Acceptance criteria

Common rules for both (a) and (b):
- **Measured at the consumer** (the executing artifact, not a log of intent).
- **By a standing system activity**: a `self_fact_reconcile` row (REALIGNMENT §2.1). It is not an operator query.
- **On both nodes**: node 1 (holder) and node 2 (compute) each report, and node 2's absence of rows reads `unobserved`, never `0`.
- **Each with a positive control and a must-fail control through the same address.**
- **Windows stated.**
- **Split by author** (`author`/`directed`, C4), so the operator lane cannot satisfy a criterion.

### (a) The ribosome reads a canonical machine rendering, mints templates that preserve the source chain, and they are reused on a different goal_hash

Extends composition-crystallization §7, items 1, 2, 3, 5 and 6, and C §7. The items marked **new** are not in those.

| # | Criterion | Instrument / window | Positive control | Must-fail control |
|---|---|---|---|---|
| a1 | **One rendering, both owners.** Every `ribosome-extract` run reads the same canonical trace rendering by `(executionId)`. It has tasks with `input_impulse_ids`/`output_impulse_ids`, `resolved_config`, `outputShapes`, failed steps, and the answer step's content by reference. Both extraction owners pass the same `reached && grounded` read from the trace (C2) | Per run; 7 d; both nodes | An exact lookup of a just-listed id returns `count ≥ 1` with non-empty `tasks` (crystallization §7.1) | A run whose lookup returns 0 tasks is `failed` (loud), not `[success, skipped×6]`. Replay `exec_cc2wv10y` (goal-host SKIP ungrounded) → no ribosome-vessel write |
| a2 | **new: edge preservation.** For each new `learned-*` row, `tasks.length` = the number of successful source tasks, and the set of `(dependency → task)` pairs equals the source trace's `input_impulse_ids → producing task` set. **Today: 0 of 17** new rows carry any dependency | At write, by `activityTemplate_write` for `author: ribosome-pattern`; 7 d | A 2-task composite → a 2-task template with 1 dependency | The `…-7inwqk` trace (2 tasks, linked ids) → a 1-task proposal is **refused** |
| a3 | **new: deterministic identity.** `id = f(sourceTemplateId or chain shape-slug)` is computed in code. 0 new ids differ only by case, truncation or suffix from an existing id with the same source | At write; 14 d | — | `uiPanel`/`uipanel` from `exec_gdusu0cl`, and `substrategy` for `satisfier:substrateGap`, are refused |
| a4 | **Product, not status.** ≥1 new `learned-*` per day, `extracted_from` reached=true. ≥1 per week from a non-self-maintenance goal (crystallization §7.2). **Today the weekly item is 0 of 14** (C §5) | Daily/weekly; both nodes (node 2 has no ribosome owner today) | `learned-composition-memorynote-to-memorynote-write` selected and reached (C §5) | A floor reach with 0 shape steps → no row, and no row ever has id `learned-universal-tool-fallback` |
| a5 | **new: reuse on a different goal_hash, by effect.** ≥1 learned template per week has `total_executions > 0` with `reached: true` on an execution whose `goal_hash` ≠ the source's `metadata.goalSignature`, **and** the reach is not on a receipt-only digest (C5). **Today: 17 of 17 new rows have 0 executions** | Weekly; both nodes | Source-goal replay reaches (instance grain) | A shape-signature borrow of a floor path (C §4.3) does **not** count. A reach whose only pool content is a 128-char `{"producedBy","executionId"}` receipt is HOLLOW |
| a6 | **Durability.** None of `severed-joint-ribosome-*`, `systematic-failure-ribosome-*`, or a "hollow extraction" class opens in 14 consecutive days. `severed-joint-ribosome-extraction` **closes on recovery** (C6) | 14 d | The joint row reads green after a 7/7 run within 24 h | The row stays open while the point lookup returns 0 |

### (b) A failure class observed in traces is detected, keyed by need/class, deduplicated, filed with a class-2 falsifier, closed by a verified landing without operator hands, and does not reappear in a different hat for 14 days

Extends gap-content §8 items 1, 4, 5 and 6, and REALIGNMENT §7 steps 2, 3 and 5. The items marked **new** come from §2 above.

| # | Criterion | Instrument / window | Positive control | Must-fail control |
|---|---|---|---|---|
| b1 | **Detected from traces, keyed by class.** A detector row reads trace or journal evidence and files under a stable key `(edit_site, defect signature)`. A recurrence increments the parent's counter; it does not mint `-narrowed`/`recommit-`/`-step-N` ids (REALIGNMENT §2.3 enrich-parent) | Per filing; 14 d | A planted canary failure is filed once | A second identical failure in the window adds `demand_count`/`reopen_count` to the same id and does **not** create a row |
| b2 | **Birth verdict, on the serving node.** The class-2 check is supplied by the detector (its own measurement as data, gap-content §5) and judged `present` at write by i3 on the node that serves the edit site. **new:** for a windowed journal or `test_suite` predicate, the check must measure the **defect**, not a symptom window, so that window expiry alone cannot flip it | Per filing and per close | `self-fact-divergence-gap-birth-verdicts-supply-backlog-rose` born present (CHECKINS 10-01 01:29) | A check reading `absent` at birth → not admissible. **new:** a detector close records `close_basis` as either `landing:<sha>` (a cited landing inside the window) or `condition_gone`, and **only `landing:` counts toward (b)**. The fixture-template parent (closed 2 h before its step landed, after operator `fe52c974` fixed the defect at another site) is a correct `condition_gone`, not a lane landing |
| b3 | **Repair without hands.** Filer and landing are both non-operator: `source ≠ human_reported`, `directed ≠ true`, `author ≠ operator`, and **no operator commit to the check file in the 7 days before the landing** (the check-first pattern `aa:ed4b82a`, `7c5e80a`, `01635c0`). **Today: 0 instances** (§2) | Per landing | — | `5bd2d5b`, `a5e52db`, `5ac23fc`, `1bc78f8` replayed as records → excluded |
| b4 | **Verified at the consumer.** Closure only by re-measure **after the serving node restarted onto the landed sha** (memory 09-28 seam 4), with the check red on the parent (`dv:d2686b7`), a behavioural mutation that turns it red, and 0 newly failing tests | Per close; both nodes | `5ca51be`, `be0ee7a` (sweep close after restart) | `235dae8` (closed as fixed while non-terminating), `a198907` (hollow, certified), and node 2 closing from a frozen copy (CHECKINS 10-01 03:29) must all be rejected |
| b5 | **Effect, not the route's existence.** **new:** for a route or producer restored, the consumer's output must be non-vacuous: not `{"invariants":0}`, not a 404 counted as success | Per close | — | `5bd2d5b`'s hollow output fails b5 although it passes b4 |
| b6 | **Durable, no new hat, 14 d.** `reopen_count` unchanged and no new id with the same `edit_site` + signature for 14 days. `predicate_verified_by_detector` counts as closed only if it stays closed 14 d. **Today: 5 rows with that reason are open at reopen_count 25–28** | 14 d; the store high-water mark is kept (no rebirth) | — | Any flap (close → reopen) resets the clock |
| b7 | **Rate, not anecdote.** On each node, the share of substrate-detected births in a week that satisfy b1+b2 is reported next to the count of b3–b6 closes. **Today: 1 of 53 substrate-detected births since 10-01 01:14Z carries a birth verdict** | Weekly | — | A week of zero is reported as zero, never as "not applicable" |

**Overlap with the plan of record.**
- a1/a4/a6 = crystallization §7 + C1/C2/C6 + REALIGNMENT §2.1 (extractor input-contract row).
- a2/a3/a5 = C3 + C4/C5, **plus the new edge-set equality, the code-side id, and the by-effect reuse test**.
- b1–b2 = REALIGNMENT §2.3 + §7 step 3 + i3, **plus the new defect-not-window rule**.
- b3–b4 = §7 step 5 + C4, **plus the new no-operator-check-in-7-days rule**.
- b5–b6 = gap-content §8.4–8.5, **plus the new hollow-output and flap rules**.

These are asks to the coordinator. Nothing here is built.

---

## 5. Method and unverified items

- SurrealDB reads: `object::keys` on one row first; no `ORDER BY`. The `dependencies` check reads `tasks.dependencies` directly; every value was `null` on the 17 new rows. The 0-of-515 figure for the older rows is C §3.3's and was not re-run (one aggregate errored on NONE arrays).
- Gap-store reads used `jq` on node 1 only. Node-2 facts are cited from the dossiers and CHECKINS, not measured here.
- Unverified:
  - whether `be0ee7a` and `e23b47b` meet C4 (they were not re-examined after the 09-30 17:15 correction);
  - the root of the `uiPanel`/`uipanel` pair (case-variance in the LLM id rule vs two owners; both rows have the same `sourceExecutionId`, and `goalSignature` is `a30a893c` on one and null on the other, which suggests one row per owner);
  - who dispatched `route-edit-8eaa2408` (the row is pruned from the store; CHECKINS 09-29 17:10 attributes it to the operator).
- Memory files cited: 08-06, 08-09, 08-14, 09-02, 09-22, 09-28, and 07-29 for the 83% audit.
