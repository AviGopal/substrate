# 2. The other machine readers of traces — each one's private renderer

Track 2 of the machine-trace-rendering census, 2026-10-02. Read-only throughout: no dispatches, no writes,
no restarts. The only live probes were reads: SurrealDB `SELECT`s, an authenticated GET of the trace list,
`jq` over the gap store and the failure-memory file, and `journalctl`.

**Question.** Every consumer that turns a trace, a walk or a dispatch record into input for a decision does
its own rendering. For each one this file records:
- what it reads;
- how it renders that input;
- what caps it applies;
- what it decides;
- what it loses.

It then asks whether one canonical machine rendering would serve all of them.

**Addresses and windows.** Every number below names one of these.

| Source | Detail | Window / size |
|---|---|---|
| Live goal-host | `/vessels/goal-host-vessel/src` = `origin/dev` **`3082a94`** (md5 of `index.ts`, `judge-view.ts`, `walk-pool.ts` and `route-around.ts` equal on both). Unit restarted **09:15:08Z** | — |
| goal-host journal | 162,248 lines | **09-26T16:26Z → 10-02T09:35Z** ("journal window") |
| goal-host journal since restart | 903 lines | 09:15Z → 09:35Z ("post-V window") |
| Failure-memory file | `/workspace/.goal-host-failure-memory.jsonl`, 2,098 lines | 09-22 → 10-02 |
| SurrealDB | ns `activity-system`, db `learning_loop` | measured about 09:40Z |
| Gap store | `/workspace/git/super-repo/gaps/gaps.json`, 6,878–6,880 rows (it was moving) | read at about 09:35Z |

Two helpers measured the learner, credit and ingest family and the concept and detector family. I re-ran
their load-bearing numbers myself; each re-run is marked **(re-run)**.

> **Read this first: slice V landed this morning.** Between 08:36Z and 09:05Z the coordinator landed V2–V8
> plus credit-by-involvement (`a6d41a4`, `2e455aa`, `937836a`, `0016142`, `fd159d4`, `a9feb0c`, `574eea7`,
> `3082a94`). Several "known facts" in the brief are therefore **pre-slice**: the constant
> `producedBy`, the 1,500/8,000 judge digest, LLM-chosen `completion_shapes` and positional composite
> edges. Each table below separates *the mechanism as of `3082a94`* from *rows measured*. The post-V
> window is 20 minutes long: 14 HOLLOW verdicts, 8 REACHED and 1 edged composite. That is too short to
> grade the new mechanisms. It shows only that they emit.

---

## 0. Findings

1. **Failure memory reads a log line, not a trace, and mostly feeds back one boilerplate sentence.**
   - **The read.** `rememberGoalFailure` is fed by a regex over the walk's step-log strings:
     `/HOLLOW — (.+?)(?:; β|$)/` over `walkStepSink`, at `index.ts:17113`.
   - **The record.** It keeps `{hash, classToken, reason≤600, pick, shapes≤12, attempts, at, deterministic}`.
     There is **no executionId, no dispatchId, no step and no content**.
   - **The boilerplate.** 450 of 1,926 records (23%, 09-22 → 10-02) carry one identical sentence:
     `deterministic:edit-intent-no-landed-edit — an edit goal is reached only by…`. It names no defect the
     next attempt could correct, yet it passes the structural-reason filter at `:4307`.
   - **How it spreads.** Near-miss recall forwards *only* deterministic records to "a similar goal". In the
     journal window there are 810 `FAILURE-RECALL` lines. 429 of them show a near-miss lesson
     (`(a similar goal`) in the 220-character log preview, and **239 of those 429** show this sentence
     there. That counts the preview only, so it is a lower bound.
   - **The outcome.** 48 of the 555 goal hashes with a failure record have reached since.
2. **One decision gate takes a log format as its input.**
   - The judge's pre-check `deterministic:hollow_walklog_capped` (`index.ts:4033–4044`) tests walk-log
     strings with the regexes `/\bstep \d+ ran /` and `/\bnew_shapes=0\b/`.
   - It decided **145 of 1,319** HOLLOW verdicts (11%) in the journal window.
   - The deterministic oracles also *re-parse* the judge's rendered digest by regex:
     `reach-date.ts:digestSegments`, `verbatim-read.ts:digestEntries`, both splitting on `^- <shape>: `.
     So the oracle chain sits on a render-then-parse round trip.
3. **The judge prompt still mixes two renderers.**
   - `buildJudgeView` (V3) is followed, at `index.ts:11256` and `:11180`, by `captureReachDigest`. That
     digest is 600 per item and 4,000 total, filters no bookkeeping, and sits **outside the view's
     `cuts[]`**.
   - So an `error` or `activity_template` impulse the view excluded can re-enter, and a cut in the
     appended part never triggers the abstain.
   - The template path (`:14631`) and the floor (`:5510`) still use their own renderers: 600/4,000 and a
     6,000-character scratchpad.
   - **Not yet observed:** the V3 abstain line `walk: ABSTAIN —` appears **0 times** in both the journal
     window and the post-V window. (The 2,356 `ABSTAIN` hits are all from `[ephemeris-oracle]`.)
4. **V4's walk-side edges now reach the durable store, but only as ids.**
   - The 20-minute post-V window holds **0 walk composites**.
   - The one edged walk composite is the slice-V acceptance run at 08:50Z
     (`walk-composite-web-search-to-llm-completion-to-memorynote-write-wq159f`, dispatch `1e3cd499`, tag
     `slice-v-acceptance`). It ran on V4 code under an earlier deploy; the `3082a94` commit message cites
     that run. It records `llm_completion` consuming `walk-ss2ppe-0tcu0c6-web_search-3` by id.
   - **Pre-V control:** there are 188 earlier `walk-composite-*` rows. All 8 I sampled carry positional,
     colliding ids (`walk-shellResult-3`).
   - Top-level `input_impulses` is still empty on **532 of 532** `execution` rows since 08:30Z, and on
     **150,127 of 150,127** all-time (helper; consistent with the brief).
   - The composite's output ids resolve to nothing. Since 08:30Z the `impulse` table gained 130 rows, all
     in 5 bookkeeping shapes, and 0 rows match the composite's pool ids.
   - Walk composites also record every step `success:true` by construction
     (`buildCompositeTraceFromChain`, `:7027`). **A walk's failed steps never enter its trace.** They live
     only in the route-around record and the walk log.
   - Learned-template traces differ: sample `exec_a2hc514h` carries a `success:false` step and real input
     ids.
5. **The route-around record (§2.0b, V6) has no machine reader.**
   - `routeArounds` is referenced in goal-host only, as writer and as server of `goalWalkState`. It is not
     durable: it sits on the dispatch record, sliced to the newest 16.
   - The journal has **12 `ROUTE-AROUND` lines, all on 10-02** (6 since the restart).
   - The §2.0b counter, threshold and encapsulation goal are not built. That matches REALIGNMENT, and the
     record is ready for them.
6. **Every task-keyed detector reads every walk row as zero tasks.**
   - The trace LIST returns `task_count = metadata.task_count ?? 0` (activity-api
     `routes/execution-traces.ts:1047/1056`; from `b5d0d4d`, 06-15).
   - **(re-run)** The newest 50 rows of the authenticated list all report `task_count: 0`, and none
     carries `tasks`.
   - Since 06:00Z, **1,415 of the 1,423** `execution` rows that do hold `trace.tasks` lack
     `metadata.task_count`.
   - So `systematic-failure-*-zero` (43 of 47 ids), `precondition-rejection-*` ("unsatisfiable
     inputShapes", 13 of 31 open on satisfier and floor rows) and the `firstFailed=no_task` clustering of
     `novel-failure-*` are all keyed on a projection artefact (§2.8).
7. **Two credit mechanisms read two different renderings of the same run.**
   - goal-host (`574eea7`) credits by *involvement along recorded edges*, in-process.
   - activity-api `propagateCreditAlongChain` credits *every ancestor by depth*, λ^d up to depth 4, over
     `composition_chain`. It never reads consumption.
   - 58,398 of the 75,482 rows with a parent (77%) are lifecycle-hook children (`validator-dispatch`
     48,501, `slot-binding` 9,897), so a failed validator puts β on what it validated (helper).
8. **The judge's chosen `completion_shapes` disagree with what was produced.**
   - **(re-run)** 1,443 of 1,825 `execution` rows carrying `completion_shapes` (all-time, 08-23 → 10-02)
     name a shape absent from that row's `output_impulse_shapes`.
   - `goal_execution_paths` stores no completion shapes at all.
   - Its `endpoint_output_shapes` means *all chain-produced shapes* at the walk sites (`:12112`, `:12147`)
     and *the judge's completion shapes* at the floor-reuse site (`:13457`), and it is overwritten last
     write wins.
   - So `recommendReachingPath` matches targets against a field with two meanings.
9. **Lessons written from traces are never graded.**
   - About 1,027 concepts carry trace or verdict content: `goal_finding` 705, `reach_gate_lesson` 277,
     `compose_lesson` 45.
   - All have `times_succeeded = 0`, and 0 `concept_usage` rows name these source types.
   - The compose-lesson failure attribution posts to routes concept-db does not serve. That is
     substrate-authored `6f691428`; the open gap `lesson-failure-crediting-posts-to-a-404-address-…`
     already covers it.
   - `failure_mode_summary` reads a 404 route (`86cd5657`).
   - The walk's concept recall uses **no `source_type` filter** over 91,136 concepts (helper).

---

## 1. Stores, and how many machine readers each has

A **reader** here is code that turns the store's content into a decision input. Human-surface reads are
listed in brackets and are covered in human-surface track 2.

| Store (who writes) | What a trace becomes there | Machine readers | Count |
|---|---|---|---|
| `execution` row (activity-api ingest) + `execution_trace_content.tasks` / `trace.tasks` | Row: ids, `output_impulse_shapes`, `signature`, `composition_chain`, `reached`, `completion_shapes`, `metadata` (`final_text` on floor rows). Tasks: per-step in/out ids and shapes, `resolver_id`, `success` (snake case, `normalizePersistedTask:236`). **No content.** | `applyOutcomeToPosteriors`, `propagateCreditAlongChain`, `deriveSignatureShapes`, `deriveCompositionEdgeFromParent`, ψ `computeTraceOccupancy`, late-reach re-grade, `trace_failure_pattern_report`, precondition-rejection-scan, phantom-trace-scan, detector-coverage-scan, orthogonality-audit `summarizeTrace`, template-repair `summarizeTrace`, `traceAggregateReport` / grouped stats, `formatExecutionTraceAsMarkdown` family (4), ribosome extraction (track 1), `goal_reasoning` | **≥17** |
| `activity_execution_traces` + view `v_paradigm_execution_traces` | Wrapper rows keyed by `execution_id`. Credit's signature lookup goes through the view. | `propagateCreditAlongChain` (`:803`), single-trace GET fallback | 2 |
| `trace_digest` (activity-api ingest, `insertTraceDigest:561`) | `task_summaries` = tier/status/duration only; `failure_mode_type`. **809 rows now** against 150k executions; reaped by retention. | exemplar-selector, learning-track-classifier | 2 |
| `activity_composition_graph` | Activity→activity pairs. 15,367 edges; 1 carries shapes; `shape_flow` empty on all 93 rows that have it; `derived_from` dropped by the schema (0 of 15,367) | `/recommend`, discover, edge blend | ≥2 |
| `goal_execution_paths` (23,093 rows) | Activity list + union of produced shapes + inferred target. **No impulse ids, no edges, no completion verdict.** `activity_sequence`, `initial_impulses` and `initial_state` are populated on 0 rows. | `recommendReachingPath` → `comparePathways` / `pinnableHead` | 1 |
| `goal_verification_labels` | Verdict per execution (deterministic or override) | goal-host `maybeConsumeOracleLabel`; the human surface writes labels. **`posterior-update.ts` reads 0** (REALIGNMENT §2.2) | 1 |
| goal-host in-process pool + dispatch record (`walkLog`, `poolProvenance`, `steps`, `routeArounds`, `answerBody`) | Full content (pool, in-process), 2,000-char previews (record), log strings | judge view; hollow_walklog_capped (regex); failure memory (regex); findings/writer digests; arg synthesis `priorFindings`; credit-by-involvement; [human surface: `goalWalkState` + 4 regexes] | 6 machine |
| `/workspace/.goal-host-failure-memory.jsonl` | `{hash, classToken, reason, pick, shapes}` | `priorFailureFeedbackFor` → attempt-1 prompt; disables replay of reached commands | 1 (prompt) |
| `/workspace/.goal-host-reached-commands.jsonl` | A verified command per goal_hash | Tier-1 replay, Tier-2 lexical rebind | 1 |
| concept-db `concept` (`goal_finding`, `reach_gate_lesson`, `compose_lesson`) | Prose: answer or verdict + pool digest, ≤4,000; class name + fixed guidance | walk recall (`recallConceptRows`), PAYLOAD GUIDANCE, `composeLessonsBlock`, boredom `goal-generation.ts:344`, learning-signal-health-observer | 5 |
| Gap store | `example_trace_ids`, a summary, `failure_lessons` (≤8) | gap-to-feature, the drafter, detector-coverage-scan (cited-trace coverage) | ≥3 |
| goal-host journal | `HOLLOW-CONTENT` (400), `reach-input`, `REACHED via` | No machine reader in-container. Operator censuses (output-shapes/4) and the surface's best-output block scrape it. | 0 machine |
| **Route-around record** (V6) | `{goal_hash, target, produced, missing_producer, failed_producers[{shape, producer, reason}], route_taken}` | **none** | **0** |
| `poolProvenance[].consumedIds` (V4, on the record) | Edges by pool id | **none** outside goal-host | **0** |

**Reading the counts.**
- The durable trace store has the most readers and the poorest rendering: ids and shapes, no content,
  failed steps only where a template recorded them.
- The two richest renderings, the in-process pool with edges and content and the route-around record with
  failed producers and reasons, have **zero durable readers**. They die with the dispatch record
  (compaction, newest 100) or the process.

---

## 2. The reader inventory

### 2.1 The reach judge (`verifyGoalReached`, `index.ts:3636`). Measured in output-shapes/4; changes since are cited

| Site | Renderer as of `3082a94` | Caps | Notes |
|---|---|---|---|
| End of walk `:11251–11256` | `buildJudgeView` (`judge-view.ts`): the deliverable first at full length; evidence as `title — url` lines; the rest under the per-shape cap; bookkeeping (`goal`, `dispatch_id`, `activity_template`, `error`, `filePaths`, `test_suite`) and provenance stubs excluded; duplicates folded; `cuts[]` recorded. **Then `+ capturedDigest`.** | Deliverable 24,000; evidence 40 lines; rest 1,500/8,000; captured part 600/4,000 | The captured part bypasses exclusions and cuts (finding 3) |
| Interim `:11175–11180` | The same, with `interimCaptured` prepended | same | — |
| Template path `:14620–14660` | Its own: the captured digest, else a store read filtered by `isBookkeepingOnly` | 600/4,000 | Hardcoding C #3, still open |
| Floor `:5505–5530` | `finalText` or the scratchpad, plus the zero-tool banner | 6,000 | Hardcoding C #4 |
| Pre-check `:4033` | **Regex over walk-log strings** (`hollow_walklog_capped`) | — | 145 of 1,319 HOLLOW verdicts |
| Oracle chain | `digestSegments` / `digestEntries` re-split the rendered digest on `^- <shape>: ` | inherits | Inference, not measured: a deliverable with a markdown bullet such as `- Source: https://…` splits into a fake `Source` segment. The `- Link:` lines of the cea3f4a4 #73 report are exactly that form. |

**What it decides.**
- `reached` / `completion_shapes`, which feed β, `/reach`, `recordGoalPath`, failure memory, concept
  lessons and capability-gap filing.
- Since V3, `completion_shapes` are restricted in code (`restrictCompletionShapes`, `:3640`).

**What is lost.**
- Edges: the judge never sees which impulse consumed which.
- Failed steps.
- The date (now supplied by V2, `reach-date.ts`).
- The full evidence set beyond 40 lines.

**HOLLOW verdicts by decider** (journal window, n = 1,319):

| Decider | Count |
|---|---|
| LLM prose | 396 |
| `edit-intent-no-landed-edit` | 369 |
| `code-investigation-uncited` | 221 |
| `hollow_walklog_capped` | 145 |
| `code-investigation-citation-unverified` | 126 |
| `partial` | 28 |
| `no-output` | 24 |
| 5 other oracles | 10 |

### 2.2 Failure memory (`rememberGoalFailure :4299`, `recallGoalFailures :4322`, `priorFailureFeedbackFor :4331`, write `:17105–17119`, recall `:12493`)

**Reads**
- the walk's step log: the regex in finding 1;
- the terminal `goalReachReason`;
- `seek.selectedTemplateId` (stored as `pick`);
- `seek.completionShapes` (stored as `shapes`).

**Renders**
- A 600-character reason string.
- A class token taken from the first two words of the goal (`goalClassTokenOf`, `:4294`).
- Recall prints `- (this exact goal, at, producer X) reason` (up to 3), plus near-miss lines **only when
  deterministic**.
- Capped at 1,200 in the retry preamble (`:8305`; hardcoding C #16).

**Decides**
- The text of the attempt-1 prompt.
- `disableReuse`: no replay of a reached command while the latest verdict is a failure.

**What is lost.** Where the failure happened:
- which step;
- which execution;
- which output was judged;
- which edge was missing.

The `shapes` field is empty on **768 of 1,926** records. Its non-empty values are the judge's
completion shapes, so before V3 they included `activity_template` and `error`.

**Measured** (failure-memory file, 09-22 → 10-02):

| Measure | Value |
|---|---|
| Failure records | 1,926 (795 deterministic, 1,131 LLM-judged) |
| Reached-supersede markers | 172 |
| Distinct goal hashes | 555 |
| Hashes later reached | 48 |
| Hashes with ≥1 edit-intent boilerplate record | 288 |
| Records on the most-recorded hash (`0ee592d0`) | 137 (5 loaded) |
| `pick = feature_compose` | 471 |
| `pick = satisfier:shellResult` | 169 |
| `pick = satisfier:activity_metrics` | 164 |
| `pick = null` | 102 |

**Prior art.**
- The open gap `compose-floors-only-console-log-their-reason-so-failure-memory-stores-no-detail` (10-01)
  covers the compose side.
- The plan of record (agentic-runner §4, "After the slice" step 6) has "failure memory into inference
  (b, `goal-target-inference.ts`)".
- **Neither plan item addresses the record lacking a pointer to the failed step, or the boilerplate
  passing the filter.**

### 2.3 The learner and credit (helper; live `lib/posterior-update.ts`)

**`applyOutcomeToPosteriors` (`:986`)**
- Reads `success`, `failure_mode`, the task tiers, and the reach tags (`classifyReach`).
- Decides α, β or ungraded on the leaf.
- Loses task outputs and which input the leaf consumed. Tasks reduce to tier labels.

**`propagateCreditAlongChain` (`:763`, called `:1380`)**
- Reads `composition_chain` (execution ids) and a batch signature lookup on `v_paradigm_execution_traces`
  (`:803`).
- Applies λ^d/k to every ancestor up to depth 4. `CREDIT_PROPAGATION_MAX_DEPTH` is an in-process constant
  (`:115`), a law-1 deviation.
- Loses whether the ancestor's output was consumed. That is the gap between depth and involvement.
- `chain_credit_no_sig` is `logger.debug` (`:871–879`) and not counted. 08-21 B6 never landed, and
  `git log -S signature_basis` finds nothing.

**goal-host credit-by-involvement (`574eea7`)**
- Reads the in-process V4 edges (`involvedSteps`).
- Credits deliverable producers plus feeders, once per dispatch.
- The open follow-up `walk-credit-fires-before-the-caller-rejects-and-blame-is-not-spread-like-credit`
  (10-02 09:01Z) is the blame half.
- **This is the only credit path that reads edges, and the edges it reads are not the ones activity-api
  re-reads on a late reach.** The late-reach path (`execution-traces.ts ~:5332`) re-runs the depth
  propagation from the stored row.

### 2.4 Signature and ψ (helper)

**`deriveSignatureShapes` (`execution-traces.ts:165`).** Tier shares over non-auth rows (n = 136,670):

| Tier | Source | Share |
|---|---|---|
| t1 | `input_impulse_shapes` | 57.1% |
| t2 | per-task input shapes | **0%** (t1 already covers every row that has them) |
| t3 | output proxy | 39.4% |
| none | — | 3.6% |

- 73% of t1 rows are keyed on `lifecycle:task:completed` or `lifecycle:task:preBinding`. Those are trigger
  shapes, not data the activity consumed.
- No basis is stamped, so a stored row cannot say which tier made its signature (08-21 §2.1(b), not landed).

**ψ `computeTraceOccupancy` (`successor-features.ts:110`).**
- It is output occupancy only.
- Inference, not measured: on the reach path (`:5377`) it reads snake-case stored tasks with camelCase keys,
  so it probably always falls back to the flat produced set. This is the same key-case class that `8f5498c`
  fixed for signature tier 2.
- γ, K and the master switch are env-gated (law 1).

### 2.5 Goal paths (`recordGoalPath :6619` → `POST /v2/goal-paths`; `recommendReachingPath :6873` → `/recommend`)

**Writes**
- `path_activities`;
- `endpoint_output_shapes` (two meanings, finding 8);
- `expected_output_shapes`;
- success = reached;
- `walk_tier`, `state_signature`, `tools_used`.

**Measured** (n = 23,093):
- `expected ⊄ endpoint` on 4,776 of the rows where both are present;
- **88** reached rows where expected ⊄ endpoint;
- **101** reached rows where the two are disjoint, counting an empty endpoint as disjoint.

**Reads.** `/recommend` matches with `endpoint_output_shapes CONTAINSANY $target`, then cover ≥ 0.5, then a
Wilson rank.

**What is lost**
- Impulse ids and edges, so a reused "pathway" is an activity list with no binding.
- The judge's verdict shapes.
- Which step reached.

This is why first/last-mile adaptation (CLAUDE.md "the middle") has nothing to bind against: the record
holds no shape-to-shape data flow to re-enter or re-exit.

### 2.6 Ingest-time derivations (helper)

**`deriveCompositionEdgeFromParent` (`:1804`, detached at `:2945`)**
- Upserts an activity→activity edge for *any* adjacent parent, with `edge_kind:'derived'` and
  `genuine:true`.
- No consumption filter.
- In the last 6 h of the activity-api journal, **1,079 of 2,076 derive attempts missed**
  (`parent_lookup_miss` 979, `parent_not_persisted` 100).
- Its `derived_from` stamp is dropped by the SCHEMAFULL table, so 0 of 15,367 rows carry it.

**`composition-edge-reconcile.ts`** (super-repo script, 30-minute root timer)
- Derives edges from parent→child pairs, from out(a)∩in(b) shape intersection, and from
  `consumed_from_task_ids`.
- Only 141 of 131,664 task-bearing rows carry `consumed_from_task_ids`.
- It writes no shape fields.

**`insertTraceDigest` (`:561`)**
- The store's own canonical-ish digest, from the Phase A+B redesign (`ab14dd7`).
- Its `task_summaries` keep tier, status and duration, with **no in/out ids, no shapes and no reasons**.
- 809 rows survive retention.

**Consumption edges.** The only producer of real consumed ids is goal-host's `boundConsumption` /
`stepEdgeOf` (V4) plus template tasks' `input_impulse_ids`, which 46,983 rows carry.
- **No ingest derivation projects either of these into the composition graph.** The graph's
  "genuine" edges are adjacency.
- The closed gap `satisfier-traces-record-no-input-impulses-…` (landed `69fe835`, 09-23) put ids on
  satisfier tasks. Nothing downstream was repointed to read them.

### 2.7 Concept lessons (helper; the recall reader verified at `index.ts:12485`)

**Writers**

| Source type | Writer | What it keeps of the trace |
|---|---|---|
| `reach_gate_lesson` | `penaliseHollowTemplate` (about `:6111–6175`) | The class only: `^deterministic:([a-z-]+)` plus fixed text. No execution, step or output. |
| `goal_finding` | The bridge (`:11720–11790`) | The answer or verdict prose plus `poolDigestHuman` (1,500 per impulse), ≤4,000 total. Successes only. No chain or edges. |
| `compose_lesson` | `appendComposeLesson` (`feature-compose.ts:3610–3815`) | The class plus `COMPOSE_LESSON_GUIDANCE[cls]`. No diff or anchor. |

**Readers**
- The walk recall: no `source_type` filter, 5 rows, 1,600 per concept, 4,000 total.
- PAYLOAD GUIDANCE: 3 rows at 400 characters each.
- `composeLessonsBlock`: query = the gap's latest class, 8 classes at 300 characters each.

**Measured** (all-time):

| Source type | Concepts | Ever loaded | Σ `times_loaded` | Σ `times_succeeded` |
|---|---|---|---|---|
| `goal_finding` | 705 | 292 | 4,453 | 0 |
| `reach_gate_lesson` | 277 | 137 | 622,996 | 0 |
| `compose_lesson` | 45 | 34 | 7,355 | 0 |

- `llm_judged_hollow` alone is 157 concepts and about 498,000 loads. The `class_token` suffix defeats the
  one-concept-per-class dedup.
- Recall by search does not increment `times_loaded`, so recall at prompt-build is unmeasured.

**What is lost.** The lesson cannot point back to the trace that taught it. Its reader therefore cannot
check whether the lesson still applies, and a bad lesson cannot be demoted, since attribution posts to a
404.

### 2.8 Trace-pattern and failure-pattern reports and gap detectors (helper; the list blindness re-run)

| Reader | Reads | Groups by | Writes | Its rendering's defect |
|---|---|---|---|---|
| `trace_failure_pattern_report` (dev-vessel `:79–236`) | LIST (limit 50) | `template \| firstFailedTask \| ok/total` | `failurePatternReport`; with `emit_gap`, `systematic-failure-<tpl>-<task\|zero>` | The list has no tasks ⇒ "zero"; **`failure_mode.reason` is dropped** |
| `failure_mode_summary` | `concept-db /traces/query` | `failure_mode.type` | — | **404**: dead since `86cd5657` |
| precondition-rejection-scan | LIST: failure, <500 ms, `task_count == 0` | template × day | `precondition-rejection-*` "unsatisfiable inputShapes (F25)" | Walk and floor rows record 0 ms and 0 tasks ⇒ a false class |
| phantom-trace-scan | LIST, then GET by id | per execution | `phantom-success-<exec>` | The only one that patched itself around `b5d0d4d`; no dedup by class |
| detector-coverage-scan | LIST + gap `example_trace_ids` | (failure_type, activity prefix) | `detector-coverage-gap-*` | Windows differ from its siblings ⇒ the same class filed twice |
| orthogonality-audit `summarizeTrace:67` / template-repair `summarizeTrace:102` | LIST / failures | string clusters | `novel-failure-*` / repair specs | Two functions with the same name and different fields; `firstFailed` always `no_task` |
| capability-gap filer (goal-host about `:5925–5975`) | The walk's missing shape | `gap-<slug(shape)>` | missing_capability | **850 rows over 850 names**: keyed on an invented name, not on a need |
| `traceAggregateReport` / grouped stats | Server-side GROUP BY | activity / status / variant | counts | No task fields, so no misread |

**Gap families** (open at about 09:35Z):

| Family | Open |
|---|---|
| systematic-failure | 41–44 (43 of 47 ids end in `-zero`) |
| precondition-rejection | 31 |
| novel-failure | 13 |
| phantom-success | 10 |
| detector-coverage-gap | 8 |
| capability `gap-<shape>` | 34 |

The floor row `universal-tool-fallback-b3e276c4-…` holds one judge verdict, and that one class appears
under four families (helper, finding 2).

**The invoker of `emit_gap:true` is unidentified.** No live seed or activity sets it, yet
`systematic-failure-ribosome-extract-zero` was detected at 10-02 05:57Z (helper; not resolved here).

---

## 3. Duplicated "render a trace for a reader" code

I counted functions that serialise a trace, a pool or a walk record into a decision input. I did not
count log lines or human UI.

| Vessel | Renderers | Count |
|---|---|---|
| goal-host | `buildJudgeView` + `renderContent` (judge-view.ts); `captureReachDigest` `:14931`; template-path store digest `:14631`; floor digest `:5510`; interim digest `:11180`; `findingsDigest` (walk-pool.ts:34); `writerFindings` (walk-pool.ts:148); `priorFindings` `:7866`; `poolDigestHuman` `:11240`; `mirrorWalkState` preview `:9971`; `priorFailureFeedbackFor` `:4331`; `buildRouteAround` (route-around.ts); and two **parsers** of the rendered digest (`digestSegments`, `digestEntries`) | 12 + 2 parsers |
| activity-api | `formatExecutionTraceAsMarkdown` `:5394`, `formatParadigmExecutionAsMarkdown` `:5488`, `formatRecentExecutionsAsMarkdown` `:5662`, `formatMultipleTracesAsMarkdown` `:5933` (routes/impulses.ts); `insertTraceDigest`; `normalizePersistedTask` | 6 |
| development-vessel | `summarizeTrace` ×2; `trace_failure_pattern_report`'s key builder; `refine-on-disagreement.ts:156` "FAILED TRACE"; `composeLessonClass` + `lessonDiag` | 5 |
| ribosome | `replay-observer.ts:buildReplayPrompt` ("RECORDED TRACE", shapes, outcome and duration only) | 1 (track 1 owns the rest) |

**About 24 renderers in total.**
- **About 16 of them render a trace into an LLM prompt.**
  - goal-host (9): judge view, captured digest, template-path digest, floor digest, interim digest,
    `findingsDigest`, `writerFindings`, `priorFindings`, `priorFailureFeedbackFor`.
  - activity-api: the 4 Markdown formatters.
  - development-vessel: `composeLessonsBlock` and refine-on-disagreement.
  - ribosome: `buildReplayPrompt`.
- The rest are data projections: `poolDigestHuman`, the `mirrorWalkState` preview, the route-around record,
  `insertTraceDigest`, `normalizePersistedTask`, the two `summarizeTrace`s and the report key builder.
- The idiom `typeof x.content === "string" ? x.content : JSON.stringify(x.content)` is copy-pasted
  **6× in goal-host `index.ts`, 1× in walk-pool.ts, 3× in ias-executor and 2× in development-vessel**.
- Their caps are 400, 600, 800, 1,500, 2,000, 4,000, 6,000, 8,000 and 24,000, each chosen at its own
  call site (hardcoding C, "each fix raised one number at one call site").
- **None of the 24 reads both the content and the edges.**
  - The judge view has content and no edges.
  - The composite trace has edges and no content.
  - The route-around record has failed steps and no ids.
  - The failure memory has a reason and no locus.

---

## 4. Where two readers disagree about the same trace (measured)

| # | Same run, two renderings | Disagreement | Measure |
|---|---|---|---|
| D1 | Judge `completion_shapes` vs `output_impulse_shapes` on the same `execution` row | Completion names a shape the row never produced | **1,443 / 1,825** rows (re-run; all-time). Top: `fileEditResult` 518, `cutoverApplied` 285, `memoryNote_write` 39 |
| D2 | goal-host credit-by-involvement (edges) vs activity-api chain credit (depth) | Different arms get α/β for one reach. The late-reach path re-credits by depth. | Structural; 77% of parent rows are lifecycle children (helper) |
| D3 | `goal_execution_paths.endpoint_output_shapes` at the walk vs the floor-reuse site | "All produced" vs "judge completion"; last write wins | 4,776 rows expected ⊄ endpoint (helper) |
| D4 | Trace LIST `task_count` vs the stored `trace.tasks` | 0 vs n | **1,415 / 1,423** task-bearing rows since 06:00Z (re-run) |
| D5 | Composite trace (every task `success:true`) vs the route-around / walk log (failed producers with reasons) | The durable trace says no step failed | Every walk composite (by construction, `:7027`) |
| D6 | Floor trace `failure_mode.reason` (a judge verdict) vs the detector families | One verdict read as "precondition rejection", "systematic failure", "phantom success" and "coverage gap" | 4 families on one class (helper) |
| D7 | Composite `reached:true` (mint path) vs `completion_shapes:null` on the same row | A reached row with no completion shapes | `walk-composite-…-wq159f` (the one edged walk composite, the 08:50Z acceptance run) |
| D8 | Judge view (bookkeeping excluded) vs the captured digest appended to the same prompt | An excluded `error` / `activity_template` can re-enter | Structural (`:11256`); not measured |

---

## 5. Prior art (searched before proposing)

**A canonical trace record already exists on paper.** The foundation defines it
(IMPULSE_ACTIVITY_FOUNDATION §"4. Record Trace", lines 489–545):
- `input_impulses`;
- `tasks[]` with `input_refs` / `output_ref`;
- `output_impulses`;
- `state_transition`;
- `outcome`;
- `parent_execution_id` / `composition_chain`.

It also says "Trace = a recorded set of impulses (inputs, intermediates, outputs)" and "Ribosome = a
resolver: trace-shaped → template-shaped" (lines 85–86).

The store has never filled `input_impulses` (0 / 150,127), and `task.output_ref` has no content behind it.
**So the canonical rendering is not a new design. It is the foundation's record, filled.**

**What was tried, and how it held**

| Attempt | What happened |
|---|---|
| `ab14dd7` Phase A+B, `trace_digest` | Built an ingest-time digest. Its task summaries dropped ids and shapes. 2 readers. Reaped to 809 rows. It held as a cache for exemplar selection, never as a shared rendering. |
| `b5d0d4d` (06-15) | Optimised the LIST projection to `metadata.task_count`. Phantom-trace-scan patched itself; its siblings were never fixed. A silent projection change broke ≥4 readers. |
| 08-21 composition-learning report: B6 (counted `chain_credit_no_sig`), B7 (`derived_from` provenance), §2.1(b) (`signature_basis`) | B6 and `signature_basis` never landed. B7 landed partly; its stamp is dropped by the schema. **Its law-2 critique (`:320`) asked that counters be emitted "as fields on the existing execution trace body … so a later detector activity can aggregate them without a journal scrape". That is the same move proposed here, made seven weeks ago and not taken.** |
| `69fe835` (09-23) | Satisfier tasks got producer/consumer ids. Its gap closed. No reader was repointed. |
| hardcoding C `boundContent` (10-01) | Proposed one bounded-content helper with roles (answer / terminal / evidence / context), `cuts[]` and abstain-on-cut. **V3's `judge-view.ts` is the judge half of it, landed.** The other sites (#2–#4, #8–#16) remain, including the captured digest that now rides alongside the view. |
| output-shapes/4 §1.3 | Measured judge-chosen `completion_shapes` feeding four consumers. V3 restricts them going forward. D1 is the historical residue still read by `/recommend` and by capability-gap demand. |
| ψ / signature work (`bceba79`, `4c6f5fe`, `8f5498c`) | Every repair fixed one key at one reader: the tier-2 key case. The same key case is likely open at ψ's reach path. |
| Human-surface track 3 (10-02) | Set the human rule "render impulse *references*, read by `(executionId, impulse_id)`, never re-run", plus coordinator ask **C1** (a content record keyed by `(executionId, impulse_id)`) and **C6** (`role: answer`, real `producedBy`, bound `consumedIds`). The machine readers need the same C1 and C6. |
| Gap store | Open and relevant: `compose-floors-only-console-log-their-reason-…`, `walk-credit-fires-before-the-caller-rejects-…`, `lesson-failure-crediting-posts-to-a-404-…` (+`-narrowed`), `reach-granted-on-completion-shape-presence-…`, `credit-is-assigned-to-the-wrong-arm-…`. Nothing open names the readers' shared rendering. |

---

## 6. Would one canonical machine rendering serve all of them?

**Yes, for what each reads. No, for how each projects it.** The defects in §0 and §4 are all of one kind:
each reader rebuilt a view from whatever fragment was within reach (a log line, a LIST row, a digest
string, the dispatch record). The fragments disagree because none of them is the run.

What fails today is the *source*, not the projection. The judge view (V3) shows a well-built projection
still being fed an extra side channel.

### 6.1 The rendering

**What it is.** The foundation's trace record (§5), filled and extended with four things already specified
elsewhere. It is a **record per execution, readable by id**, produced once at ingest from what the walk
already holds in process. It is not a new service.

| Part | Content | Already specified as |
|---|---|---|
| `impulses[]` | `{impulse_id, shape, role: goal\|evidence\|intermediate\|answer\|bookkeeping, producedBy, producerExecutionId, consumedIds[], size{chars, truncated, stop_reason}, content_ref}` | Human-surface C1 + C6; V4 already computes every field except `role` and `content_ref` |
| `steps[]` | `{step, producer, input_impulse_ids, output_impulse_ids, status: ok\|failed\|refused\|carried, reason?, route_taken?}`, **failed steps included** | Foundation `tasks[]`; V6 `failed_producers` folded into steps |
| `verdict` | `{reached, decider: oracle-name\|llm\|abstain, reason, completion_shapes (restricted), cuts[], label_ref}` | REALIGNMENT §2.2 `goal_verification_label` (record by execution); V3 `cuts[]` |
| `content` | A bounded store keyed by `(executionId, impulse_id)`, read never re-run | Human-surface C1 |

**Facts the walk holds in process at end-of-walk** (the rendering's source):
- the pool with content;
- V4 provenance and edges;
- V6 failed producers;
- the V3 verdict and cuts.

**What each reader needs from it, and what stays private**

| Reader | Needs | Keeps private |
|---|---|---|
| Reach judge | The answer-role impulse at full length, evidence-role impulses, cut accounting | Its projection order and caps (judge-view.ts), its oracle families, its prompt. **It stops re-parsing a rendered string**: oracles read `impulses[]` by role, not `^- shape: ` segments. |
| Failure memory | `steps[]` where `status=failed` (locus + reason), `verdict.decider`, the judged answer's `impulse_id` | Its goal_hash and class-token index and its recall policy. **A record gains `executionId` and `failed_step`; a verdict with `decider` structural (no step, no answer) is not a lesson.** |
| Learner and credit | `steps[]` edges (`consumedIds`), `verdict` | λ, depth and the α/β math (law: do not touch the math, 08-21 §2.1). Credit by involvement becomes **one** reader of edges, in activity-api; goal-host's in-process copy goes. |
| Signature / ψ | `impulses[]` with `role ∈ {goal, evidence}` consumed by step 1 (the true input set), with a basis stamp | Tiering and hashing. Lifecycle trigger shapes are `bookkeeping` by role, so they stop dominating t1. |
| Goal paths / recommend | Step sequence with edge-bound shapes; `verdict.completion_shapes` as its own field | Wilson / mode ranking. `endpoint_output_shapes` keeps one meaning. |
| Ingest edge derivation | `steps[]` consumption | Edge-kind policy. An edge is minted from consumption, not adjacency; adjacency stays a separate `edge_kind`. |
| Concept-lesson writers | `verdict`, a pointer to the failed step or the answer impulse | Class taxonomy and dedup. **Every lesson carries `source_execution_id` + `impulse_id`**, so a reader can re-check it and attribution has a target. |
| Pattern reports and detectors | `steps[]` with status and reason, `verdict.decider` | Grouping keys and windows. **They read the record, never the LIST projection**, so a projection change cannot blind them again (D4). |
| Ribosome (track 1) | `steps[]` edges + roles + verdict | Template synthesis |

**Two things must stay out of the rendering**
1. **Prompt text.** The rendering is data. Each LLM reader keeps its own projection; the judge view is the
   model.
2. **A re-run path.** Content is a read of the recorded impulse. That is the same rule as human-surface
   C2, for the same reason: `web_search` re-run is a different answer.

---

## 7. Asks to the coordinator

These are asks, not edits. Each names its seam, gate, builder, verification and overlap.

| # | Ask | Seam | Gate (deterministic) | Builder | Verification (positive / must-fail) | Overlap |
|---|---|---|---|---|---|---|
| **M1** | **Fold failed steps and the verdict into the composite trace.** Steps with `status:failed\|refused` and `reason` (from V6's `failed_producers`), plus `verdict.decider` and `cuts`, posted with the composite. Floor and satisfier traces carry the same `steps[]`. | goal-host `index.ts:buildCompositeTraceFromChain :7027` + the V6 emitter; activity-api `normalizePersistedTask :236` (whitelist `status` / `reason`) | §2.1 row: "every walk composite with a route-around record has ≥1 non-ok step" | (a) goal-host and activity-api ingest; `normalizePersistedTask` is in routes (inference: activity-api `routes/` is not listed in autonomyScope, so (b) may apply; confirm) | **Positive:** a re-dispatch of the slice goal with `web_search` refused records a failed step. **Must-fail:** today's `wq159f` row (all ok, while its dispatch's route-around exists) | **Extends V6** (the record stays on `goalWalkState` too). REALIGNMENT §2.0b's counter then reads the *trace*, which is durable and replicated, instead of the dispatch record. **New:** the trace-side carrier. |
| **M2** | **Failure memory keyed to a locus.** The record gains `executionId`, `dispatchId`, `failed_step` and `answer_impulse_id`. It is fed from the verdict and the M1 steps, **not the log regex at `:17113`**. A `decider` with no locus is not stored as a lesson. Near-miss forwarding requires a locus, not merely `deterministic`. | goal-host `rememberGoalFailure :4299`, the call site `:17105–17119` | Must-fail fixture: the edit-intent boilerplate record is refused; today 450 of 1,926 are stored | (a) | **Positive:** an LLM-judged hollow on the slice goal stores its step and answer id, and its recall text names the step. **Must-fail:** the boilerplate (no locus) is not recalled for a similar goal. Today it appears in ≥239 of 429 near-miss recalls. Re-measure that share. | Plan §4 step 6 ("failure memory into inference") reads this record, so **M2 should precede it**. The open gap `compose-floors-only-console-log-…` is the compose-side writer; **extend it, don't mint**. |
| **M3** | **One judge input.** Drop `capturedDigest` from the judge prompt at `:11256` / `:11180`; captured content enters the view as pool entries so exclusions and cuts apply. Move the template (`:14631`) and floor (`:5510`) sites onto `buildJudgeView`. The `hollow_walklog_capped` pre-check reads step status (M1), not log strings. Oracles read entries, not `digestSegments` / `digestEntries`. | goal-host `index.ts` + `judge-view.ts`, `reach-date.ts`, `verbatim-read.ts` | §9.3 row 1 (no silent truncation): every label's `cuts[]` covers every byte in the prompt | (a) for `index.ts`; (b) for the module files, if outside the exclusion set (inference, as in hardcoding C) | **Positive:** the cea3f4a4 4,965-character report is judged with `cuts=[]`. **Must-fail:** an `error` impulse in the captured digest is visible in the prompt today and absent after. A deliverable containing `- Link: https://…` bullets yields one deliverable segment, not N. | **This is hardcoding C migration step 1, finished.** V3 did the walk sites. Not new. |
| **M4** | **Detectors read the record, not the LIST.** Either the LIST returns `array::len(trace.tasks)` and first-failed-step, or the three task-keyed detectors read by id (phantom-trace-scan's own fix, `b5d0d4d`-era). `trace_failure_pattern_report` keeps `failure_mode.reason`. | activity-api `routes/execution-traces.ts:1047/1056`; dev-vessel `trace-failure-pattern-report.ts`, `precondition-rejection-scan.ts`, `vector-space-orthogonality-audit.ts` | §2.1 row: "LIST `task_count` = stored `len(trace.tasks)`"; must-fail today, 1,415 / 1,423 | (b): none of these files is in the exclusion list (activity-api routes inferred, as in M1) | **Positive:** `walk-satisfier-2-1790929244701` (1 task stored) lists `task_count:1`. **Must-fail:** today's 50/50 zeros. Then re-run each detector and expect the `-zero` and "unsatisfiable inputShapes" families to stop growing on floor and satisfier rows. | **New.** The dead-detector cleanup (`failure_mode_summary`, 404) belongs to REALIGNMENT §4 fossils. |
| **M5** | **One credit reader of edges.** activity-api chain credit reads task consumption (`input_impulse_ids` → producing execution), not depth. Lifecycle-hook children (`validator-dispatch`, `slot-binding`) are excluded by **role**, not by an env list. goal-host's in-process involvement credit retires once the store reader exists. | activity-api `lib/posterior-update.ts:propagateCreditAlongChain :763` | Count conditioned writes by `edge_source` (consumption vs depth); 08-21 B6, finally as a field on the trace body, not a debug log | (a) (`posterior-update.ts` is excluded) | **Positive:** for `wq159f`, `web_search` and `llm_completion` get α and `memoryNote_write` (consumed nothing) does not. **Must-fail:** a failed `validator-dispatch` child no longer moves its parent's β. | REALIGNMENT §2.2 (credit through one reader, which also wants labels). The open `walk-credit-fires-before-the-caller-rejects-…` is the blame half. **Overlaps 574eea7**; this moves it to the store. |
| **M6** | **Lessons carry their source.** `goal_finding`, `reach_gate_lesson` and `compose_lesson` writes include `source_execution_id` and `impulse_id` / `failed_step`. Recall filters by `source_type` at the walk. | goal-host `:6111–6175`, `:11720–11790`, recall `:12526`; dev-vessel `feature-compose.ts:3610–3815` | §2.1 row: "every lesson concept resolves its source execution" | (a) goal-host / feature-compose | **Positive:** a new `goal_finding` resolves to its execution. **Must-fail:** existing rows (0 of about 1,027 resolvable). | Attribution routes: the open `lesson-failure-crediting-posts-to-a-404-…`; **extend it.** |
| **M7** | **The content record** (human-surface C1) is also the machine readers' content source: judge oracles (G1 grounding needs the whole URL set), lesson writers, ribosome. | as human-surface C1 | as C1 | as C1 | as C1 | **Already asked (human-surface C1/C6).** Listed so it is built once for both audiences. |

**Order.**
1. M1, then M2, then M3. Each uses data the walk already holds; M3 is half-landed.
2. M4 is independent and (b), so it can be dispatched now.
3. M5 and M6 follow M1.
4. M7 rides human-surface C1.

**Generator questions (law 6) for this track's own findings**
- **D4 / M4: the projection change that silently blinded four detectors.** The detecting activity is a
  §2.1 row comparing any reader's projection against the stored record for a sampled id. That is the
  "positive control through the same address" rule, made standing.
- **The 23% boilerplate in failure memory.** Its generator is a hollow-cluster check over recall *texts*:
  the same lesson text recalled for N distinct goals ⇒ the lesson carries no goal-specific content. The open
  gap `the-missing-verifier-generator-only-mints-quantitative-families-…` is the nearest organ.

---

## 8. Not verified

- The invoker of `emit_gap:true` on `trace_failure_pattern_report`.
- ψ's reach-path key case: inferred from code.
- The `- Link:` digest split: inferred. No fixture was run.
- Whether activity-api `routes/` and the dev-vessel scan files sit outside `autonomyScope.excluded_paths`:
  inferred from the REALIGNMENT §2.0 list.
- The effect of the post-V window on any rate: 20 minutes, too short to measure.

Temp artefacts were removed after this census: a read-only SQL helper and two journal extracts in the
container's `/tmp`, and one REALIGNMENT extract on the host.
