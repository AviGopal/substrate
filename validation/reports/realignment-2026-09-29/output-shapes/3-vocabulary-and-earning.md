# Output shapes, track 3: vocabulary, earning, and why the wrong learned composition wins

Scope: why the news-report goal ("What is happening today? ... produce a report with the main headlines and some commentary on each", goal_hash `a30a893c`) ends with no useful output shape. This track covers the shape vocabulary, how a useful producer would be earned, and why `learned-composition-problem-detection-to-obsidian-write-note` keeps getting selected.

Evidence: dispatches `5bef2e86` and `cea3f4a4` (`GET 127.0.0.1:18210/executions/<id>`), discovery on :18100, SurrealDB `activity-system/learning_loop` (read-only), the goal-host and ribosome journals, and the live gap store `/workspace/git/super-repo/gaps/gaps.json` (6,796 rows). All reads were taken 2026-10-01 between about 10:40Z and 11:30Z. No dispatches and no writes.

The brief cites a REALIGNMENT §9. REALIGNMENT ends at §8. The nearest item is §7 step 9 (earn-in of autonomy scope), and that is the one cited below.

---

## 0. Summary

The walk does not fail because a deliverable producer is weak. **The vocabulary contains no targetable deliverable, and it does contain a dead terminal that every instrument reads as served.** Five problems compound:

1. **No targetable answer shape exists.** Of the 407 advertised shapes:
   - none means "an answer or report for a person about the world";
   - none means "the current date";
   - the two in-process carriers of an answer, `goal_answer` and `human_presentation`, are emitted only after a reach and are not advertised (0 of 407).
2. **The dead terminal `obsidian:write_note` is in the inference vocabulary.**
   - It enters through `/v2/activities/deliverable-shapes`, whose "evidence gate" `ev > 0` is vacuous: 639 of 639 eligible learned rows have `ev = 0.5`.
   - It qualifies at exactly the frequency floor (5 composites, FLOOR = 5).
   - Every one of those composites has 0 successful executions, and no registered vessel serves any `obsidian:*` shape.
3. **The vocabulary also blinds the capability-gap filer.** `fileCapabilityGap` checks "already served" against the same vocabulary, so it refused `obsidian:write_note` 35 times in the journal window (09-26 10:12Z → 10-01).
4. **Selection cannot learn its way out.** The β-penalised template is rejected by the posterior gate on one pick path but chosen on the other.
   - The backward-chain path has no posterior gate.
   - Its only exclusion is the per-walk `chain`/`exclude` set, which starts fresh on each walk.
   - Each walk therefore runs all three declared producers of the dead terminal in turn.
5. **The earning path is closed for this goal class.** Ribosome extraction and `mintReachedTrace` both require a reach. This class cannot reach, for two independent reasons:
   - the terminal is dead;
   - the judge lacks the date: `cea3f4a4` attempt 2 produced a correctly dated, sourced report and was graded hollow for "incorrect date".

   Demand counting cannot accumulate either. It is keyed by the shape name that inference invents (news / news_content / news_data / headlines / headlines_summary), and the capability-gap store shows 850 rows over 850 distinct shapes.

---

## 1. Registry vocabulary

### 1.1 Where the descriptions live, and why there are 51 of them now and not 312

- **Endpoint.** Descriptions come from `GET /registry/shape-descriptions` on discovery.
  - At 10:45Z it returned **51** descriptions for **407** shapes (`/registry/stats`: 12 vessels, 407 shapes; discovery uptime 10,225 s).
  - The 312 cited in §2.0b is real, but it does not last.
- **Learned descriptions are held in process memory only.** Discovery keeps them in `private learnedDescriptions = new Map` (`discovery-vessel/src/registry.ts:124`). The auto-describe tick refills them at 5 shapes per 20 minutes (`scripts/substrate/auto-describe-resolvers.ts`, timer active since 09-26).
  - `/workspace/metrics/auto-describe.jsonl` has 13,303 lines since 06-28, of which **10,389 are `describe` LLM calls for 341 distinct shapes**, about 30 calls per shape.
  - The daily maximum of `described` reached 312 on 09-27 through 10-01. After the most recent discovery restart it read **46** (tick_done 10:45:47Z).
  - Every restart re-pays the LLM cost for the whole catalogue and leaves inference description-blind for about 17 hours.
- **The tick skips delivery verbs by design.** `SKIP_PATTERNS` includes `/_write$/` and `/Write$/`. As a result, `uiPanel_write`, `memoryNote_write` and `uiQuestion_write` never get a description. Those are the only verbs that put something in front of a person.
- **Learned descriptions are often confabulated.** A keyword pass over the 263 learned-only descriptions found **at least 21 (lower bound)** that place the shape in a foreign domain. Examples:
  - `gap_compose`: "genomic"
  - `vessel_exercise_scan` and `vessel_demand_report`: "maritime"
  - `rhythm_reality_sync`: "digital audio"
  - `unaccounted_landing_scan`: "planetary landings"
  - `docs_align_scan`: "physical documents"
  - `vessel_mitosis_evaluate`: "cell division"
  - `obsidian_reflect`: "dark, glass-like materials"
  - `credit_primed_concepts`: "lending decisions"

  §2.0b proposes that inference should **read** these. Wired in as they are, they would steer inference wrong (law 8: the right information at the right time, not merely more of it).
- **Goal-host reads no descriptions at all.** It has 0 occurrences of `shape-descriptions` in `src/`. Control: the same grep finds development-vessel's `author-composed-capability.ts:160` reader. `fetchKnownShapes` (`index.ts:5630`) unions three name lists: `/registry/shapes`, peer registries, and `/v2/activities/deliverable-shapes`.

### 1.2 Classification of the 407 shapes

Method:
- Each shape gets one class, assigned by its name and its best description (advertised if present, otherwise the most recent learned line in the jsonl).
- **Method:** an explicit list of 60 general tools.
- **Delivery/mutation verb:** a regex on `_write|_update|_delete|_create`, git/gh mutations, dispatch, mitosis and similar.
- **Deliverable candidate:** an explicit list.
- **Internal:** everything else.
- Coverage: 51 advertised, 263 learned-only, 93 undescribed (mostly `_write` verbs and `*_tick`/`*_observer`).

| Class | Count / 407 | Notes |
|---|---|---|
| Internal telemetry / self-model | 238 | Includes all 28 shape names containing "report". Every `*_report` is substrate telemetry (vessel_health, failure_count, load_attribution, template_audit and so on). |
| Delivery / mutation verb | 100 | 93 of all undescribed shapes fall here or are ticks. |
| Method (general tool) | 60 | web_search, webSearchResult, http_fetch, llm_completion, llmCompletion, fs_*, code_*, git read, shell/bash, embed, cluster, json_path_extract, human_input… |
| Deliverable candidate | 9 | `memoryNote`, `obsidian:note with project list content`, `project_plan`, `docs_decision_deliver`, `obsidian_deliver_assist`, `assessment_summary`, `substantive_findings`, `goal_summary`, `obsidian:ui_screenshot`. **None is an answer about the world.** `substantive_findings` and `goal_summary` are development-vessel self-reports. The obsidian ones are plugin-assist shapes. |
| A report or answer for a person on an arbitrary topic | **0** | `goal_answer`, `human_presentation` and `obsidian:write_note` are each absent from `/registry/shapes` (`index()` returned `null` for all three). |
| Current date / time | **0** | A name grep for clock, time, date, now, calendar, today and temporal returns only `rhythm_*` ticks and `unknown_shape_report`. |

### 1.3 Who serves what

Producers were mapped through `GET /vessels/:id`. The 11 of 12 registered vessels that were fetched cover 405 of the 407 shapes. The two left over are `mcp:tool_call` and `code:analysis_context`.

| Shape | Producer(s) |
|---|---|
| `uiPanel_write`, `uiQuestion_write` | development-vessel-local, human-surface-vessel, stateful-ui-vessel |
| `memoryNote_write`, `memoryNote` | development-vessel-local |
| `web_search`, `webSearchResult` | local-tools-vessel |
| `llm_completion`, `llmCompletion` | llm-resolver-vessel |
| `http_fetch`, `human_input` | development-vessel-local |
| any `obsidian:*` write | **none** (no fetched vessel lists one) |
| current time | **none.** `clock-vessel` declares `currentTimeReport` (`repos/clock-vessel/src/config.ts:3`), but it is the 06-02 "first substrate-authored vessel scaffold" (`e9c1d2fa`): its `resolveDispatch` is a `// TODO` switch that returns `shape:"error"` for everything, there is no `src/index.ts`, no systemd unit, and it is plain files in the super-repo, so it is not substrate-authorable (memory: authorability = submodule membership). |

The `error` satisfier in the walk was served by development-vessel. It is not related to the clock stub's `error` return.

---

## 2. The three templates, and why the β-penalised one is picked again

### 2.1 Definitions (from the `activity` table) and beliefs

| Template | Declares in → out | Origin | VPM (`variant_performance_metrics`, bare id) | `context_thompson_scores` |
|---|---|---|---|---|
| `learned-composition-problem-detection-to-obsidian-write-note` | in `[activity_template, error, goal]` → out `[problem_detection, obsidian:write_note]`. Two tasks with `inputShapes:[]` and bare `config:{type}`: resolver `problem_detection`, then resolver `obsidian:write_note`. | Created 06-30 15:14Z. Tags `ribosome.extracted, lifecycle.driven, composition`. A predecessor row `composition:problem-detection-to-obsidian-write-note` had α−1 = 3.4 over 4 observations by 06-30 22:50, when an Obsidian resolver still existed in-container. | **Beta(1, 63.2), 241 executions, 0 successes** | 176 buckets across two id spellings: 114 `activity:⟨…⟩` buckets with 241 observations, all β; 62 bare-id buckets with Σβ−1 = 474.7 |
| `auto-bridge-obsidian:write_note` | in `[goal]` → `goal_file_extract` → `llm_completion_dispatch` → resolver `obsidian:write_note` → sense-back `obsidian:note` | 06-25, `author_producer` "mint-as-you-go" | Beta(47.2, 118.3), 94 executions, **9 successes** (the July era, when the producer existed) | — |
| `learned-deadline-note-index-v2-robust` | in `[activity_template, goal]` → 7 Obsidian-oriented tasks, out includes `obsidian:write_note` | 07-03, `ribosome.extracted` | Beta(14.5, 69.0), **186 of 186 `successful_executions`** | 60 prefixed-id buckets, 173 observations, **all α** |

On the third row: the template "completes" with `new_shapes=0` in both dispatches. That counts as success at the execution layer while the reach gate β-penalises it. The two credit layers disagree.

The `activity` table's `thompson_alpha` and `thompson_beta` are 1/1 on all three rows, which matches the memory note that this table's posteriors are vestigial.

The obvious query `activity_id CONTAINS '…'` returned 0 VPM rows. That was a false zero (`CONTAINS` is an array operator). Selecting by record id returned the rows above.

**All live producers of the terminal.** `SELECT … FROM activity WHERE output_shapes CONTAINS 'obsidian:write_note'` returns 8 rows. Four are live: the three above plus a `-1782869944057` variant. Four are retired `proposed_pattern_authored_operator_goal_*` rows from 06-16/17, one of them `…_unservable_what_is_new_how_are_you`. A "what is new" goal was mapped onto this terminal in June too.

### 2.2 Mechanism (code-level)

1. **Inference names the dead terminal.**
   - Targets are filtered against `fetchKnownShapes()` (`goal-host index.ts:5630`). That function unions the output of `/v2/activities/deliverable-shapes` (`activity-api routes/activities.ts`, the `app.get('/deliverable-shapes')` handler, added in `2c91aaf` on 07-31).
   - Admission to that list is `retired=false AND ev>0 AND id starts with learned-/composed-cap`, terminal = produced minus consumed, frequency ≥ FLOOR (5).
   - Measured: **639 of 639** eligible rows have `ev = 0.5`, so the gate admits everything.
   - `obsidian:write_note` is the terminal of exactly 5 composites: 3 `learned-auto-bridge-obsidian-write-note*` and 2 `learned-composition-problem-detection…`. Their VPM success counts are 0, 0, 0, 0 and n/a.
   - 3 of the 28 "deliverable" shapes have no registry producer: `obsidian:write_note`, `obsidianAssistDelivered` and `conceptDescription`.
2. **The walk's pick path (b) correctly rejects the proven-bad composite.**
   - `isIrrelevantLearnedComposite` (`index.ts:10277`) returns true when α+β ≥ 12 and α/(α+β) < 0.15.
   - For this template n = 64.2 and the ratio is 0.016.
   - `discover-by-shapes` carries those numbers to goal-host: VPM → `metrics.thompson_*` → `readCandidateShapes` (`index.ts:7256`).
3. **The walk's backward-chain path (c) has no such gate** (`index.ts` ~10550–10580; the journal string "backward-chain — … needs […]; producing inputs first" is emitted only there).
   - Its filter is `producers.find(!isHollowScaffold && inputs satisfied) ?? producers.find(inputs satisfied)`, followed by a recursion that adds the chosen producer's inputs as sub-targets.
   - That recursion is why the walk satisfies `activity_template` (the 7 KB template catalogue) and `error`: they are this template's **declared inputs**, not anything the goal needs.
4. **No cross-attempt exclusion exists.**
   - `exclude` is `new Set()` per walk (`index.ts:9634`). FEEDBACK-RETRY re-runs "the same chain" (`index.ts:13214`).
   - Failure memory records `pick`, but its only reader is prompt text (§3.3).
   - So within each walk the three declared producers run in sequence: steps 3, 5 and 7 in both dispatches and on both retries. The last one to fail becomes `selectedTemplateId` and takes the β.
5. **The resolver's absence is known at run time and goes unused.**
   - The engine logs `failed after 2 task(s): Resolver 'obsidian:write_note' is not registered` (09:32:43Z and 09:34:34Z).
   - Nothing turns that deterministic fact into a demotion or a vocabulary removal. It is fed to the LLM judge as "hollow content".
6. **Context-bucket fragmentation is a contributing factor, not the cause.**
   - The posterior is split across 176 buckets and two id spellings.
   - The legacy context reader is structurally zero; activity-api's own log says so (`activities.ts` ~6435, 8-hex versus 16-hex keys).
   - Even where VPM is read correctly, path (c) ignores it.

---

## 3. The ribosome, earning, and FAILURE-RECALL

### 3.1 Extraction preconditions (reached only)

- **ribosome-vessel `onExecutionCompleted`** (`src/index.ts:286–420`):
  - extracts only if `reached && allSucceeded`, where every task is terminal and successful by the durable census;
  - applies a recursion and depth bound (`learned-` count ≤ `extractionPolicy.maxExtractionDepth`, falling back to 1);
  - reads `reached` from the trace column (`reachVerdictOf`, :454).
- **goal-host `mintReachedTrace`** (`index.ts:6996`) adds `isGroundedHonestReach`: the verdict must be deterministic, or there must be a real in-chain producer→consumer edge or an executed-command anchor. Otherwise it logs `reach->mint: SKIP ungrounded`.
- **Journal window 09-26 10:12Z → 10-01 11:30Z:**
  - goal-host ran the ribosome-extract **96** times and skipped 21 ungrounded reaches.
  - Shape mix of the 96: `["shellResult","memoryNote_write"]` 62, `filePaths` 6, health/topology/telemetry most of the rest.
  - **1 was `["webSearchResult","memoryNote_write"]`.** So the path can mint a web-grounded composition when a walk actually reaches.
  - The ribosome-vessel journal for the last 24 h is dominated by `skip — ungradable producer` (validator-dispatch 9,082; slot-binding 1,837).
- **Activity rows with `created_at` in the last 7 days:** 26, of which 13 are `learned-*`. All 13 are telemetry or satisfier shapes. All 13 are dated 09-30, so they may be upserts rather than fresh mints; the count is not presented as a mint rate.

**Consequence.** A goal class that never reaches can never earn a producer through the ribosome or `mintReachedTrace`, by construction. This is correct under law 4 ("earned by doing"). It means the work is to make the class *reachable* through the floor, not to declare a producer. For this class two independent blockers stand in front of a reach:

- **Dead terminal.** §2.
- **The judge has no date.** In `cea3f4a4` attempt 2 (09:57Z) the walk produced a report headed "Today's date: Thursday, 1 October 2026 … Sources retrieved at ~08:57 UTC" with sourced headlines. It was graded hollow. In `5bef2e86` the judge rejected "Today is Thursday, October 1, 2026" for "an incorrect date". The open gap `reach-judge-and-synthesis-lack-the-current-date-so-time-relative-goals-invert` (human_reported, 10-01) has the same evidence. The re-frame in the same dispatch fabricated "June 7, 2024".

Note also that `answerBody` is `null` in both records: the answer carrier is built only when `reached === true` (`index.ts:11355`).

### 3.2 Route-around emitter, counter, and encapsulation-goal generator at HEAD

Method:
- `grep -arl --include=*.ts` over `repos/*`, excluding node_modules, worktrees, `.d.ts` and tests.
- Positive control through the same command: `FAILURE-RECALL` → 1 file (`goal-host-vessel/src/index.ts`).

Results:
- `route-around|routeAround|route_around|routed via|routedVia|routed_via` → 5 files. All are unrelated prose or fields: a JWT comment, `routed_via: "discovery:concept_create_write"`, deployment/minibob, and the obsidian sidecar. **No route-around record emitter.**
- `encapsulat` → 1 file, a docstring in `walk-continuation.ts:41`. **No encapsulation-goal generator.**
- This confirms §2.0b "prior attempts: none" for the emitter and the generator.

**The nearest existing counter is c11's `fileCapabilityGap`** (`goal-host index.ts:5741`). It counts demand as distinct goal texts per **exact missing-shape name** and opens a gap at ≥2. Three defects:

1. **It is keyed on an invented name.** Gap store: **850** `kind:capability_gap` rows over **850 distinct `missing_shape` values**; 27 have demand ≥ 2; status closed 799 / open 30 / rejected 21.
   - This one need appears as `gap-news` / `gap-news-content` / `gap-news-data` (09-24, "What is going on in the world?") and `gap-headlines-summary` / `gap-headlines` (09-30 / 10-01, this goal).
   - Each is closed `walk_artifact` at demand 1. The 09-28 audit says the same: "697 open capability gaps, 697 distinct shapes, 0 demanded by 2+ goals".
2. **It checks "already served" against `fetchKnownShapes()`, which includes the learned vocabulary.** Journal: `already served: obsidian:write_note` **35** times in the window, including 09:32:46Z and 09:35:03Z for this goal.
3. **It skips shapes by prefix.** Anything starting `obsidian:` or ending `_write` is skipped as "cold-unreachable by design" (`index.ts:5767`). The same skip appears in `fileReachabilityGap`.

### 3.3 What FAILURE-RECALL changes

- `priorFailureFeedbackFor` / `recallGoalFailures` (`index.ts:4140–4195`) keep at most 5 records per goal_hash in `/workspace/.goal-host-failure-memory.jsonl`.
- **Consumers (exhaustive):**
  - `priorVerdictFeedback` is passed to the walk (`:13168`, `:13230`). Its only reader is the synthesis-prompt preamble for the llm_completion satisfier (`:8093`).
  - `_priorExactFailures > 0` sets `ablation.disableReuse` on attempt 1 (`:13180`), which disables reached-command replay.
- **It does not change target inference, the vocabulary, producer selection or exclusion.** The record's `pick` field has no reader.
- `rememberGoalFailure` **drops** any reason matching `no pick|no producer|missing shapes|constructible payload|…` (`:4155`). The structural cause ("missing shapes [obsidian:write_note] have no producer") is therefore never remembered. Only the judge's prose about content is kept.

---

## 4. Prior art

| Item | What exists | Status |
|---|---|---|
| Prose-answer / human-presentation shape | Operator memory 07-26 (`reference-human-interface-floor-diagnosis-2026-07-26.md`): "substrate has NO prose-answer target shape" (395-shape registry then). Filed `gap-human-question-no-prose-answer-pathway-shape-name-collision` and `gap-no-human-presentation-shape-answerbody-leaks-mechanics`. | **Absent from all three gap stores now.** Control: the same grep finds other `gap-human-*` ids (`gap-human-judgment`, `gap-human-surface-rendering`) in `/workspace/gaps/gaps-resweep-snapshot.json`. The operator's fix was "deferred". |
| `goal_answer` + `human_presentation` pool shapes | `9a9fef6` (07-07) answer-delivery; `a72ad1a` (07-26) "emit a shaped human_presentation impulse on reach (law-1 keystone)". | Emitted **post-reach only**, never advertised, so they cannot be targets. Mechanism chunk-12 M14: "keep-specific … verify there is a reader". |
| Learned deliverable vocabulary | `2c91aaf` / `6082c2e` (07-31) `/deliverable-shapes` + `fetchLearnedDeliverableShapes`. | Live. Its "evidence-gated (ev>0)" claim is vacuous (639/639). |
| Terminal-shape-not-served gap | `goal-target-inference-proposes-a-terminal-shape-no-producer-serves` (open, 09-30, human-surface lane). `edit_site` is the activity-api deliverable gate. | Diagnosis matches §2. Its claim "ev>0 appears to mean the template has run (unverified)" is **verified false here: ev is a flat 0.5 default**. `falsifier: "none"`, so the gap cannot close on a predicate. |
| Date for the judge and synthesis | `reach-judge-and-synthesis-lack-the-current-date-…` (open, 10-01). | Goal-host `index.ts` edit site, builder (a). |
| Topical misread of world questions | `goal-target-inference-reads-what-is-happening-in-the-world-as-substrate-health` (09-22). | Closed `already_resolved` 09-29. Its `route-edit-*` children are still open. |
| Capability-gap filer (c11) | `b638e7b` (06-25) leaf→authoring escalation; demand-count gating added later. | Live, with the three defects in §3.2. |
| Change-series orchestrator (c24) | `development-vessel/src/resolvers/change-series-tick.ts`. | A multi-file **edit** stepper. It does not chain produced outputs to open goals, so it is not yet the §2.0b chaining organ. |
| Auto-describe tick | `8edd8619` (super-repo), discovery `b123b8e`. | Live, with volatile storage, `_write` skipped, and confabulated descriptions (§1.1). |
| Clock / date producer | `e9c1d2fa` (06-02) clock-vessel scaffold. | A stub, never deployed, not authorable. |

---

## 5. Proposals

Each proposal lists its seam, a deterministic gate, its builder, the controls that verify it, and where it sits relative to REALIGNMENT.

**No hand-declared report shape or template is proposed.** Under law 4, a deliverable producer should be *earned*:
- make the class reachable on the floor, through web_search → llm synthesis (with the date in context) → a delivery verb that exists (`uiPanel_write` for the human surface, `memoryNote_write` when a durable note is wanted);
- let the existing ribosome / `mintReachedTrace` extract the reached, in-chain-grounded composition. The `webSearchResult→memoryNote_write` mint above shows this works.

The advertised name a person-facing answer carries should then be the existing `human_presentation` pool shape (law 3: reuse, do not mint `report`/`answer`). It becomes advertisable once a learned composite terminates in it with reached evidence. The deliverable-vocabulary gate below admits it by evidence, not by declaration.

### P1. The deliverable vocabulary admits only producible terminals
- **Seam:** `activity-api routes/activities.ts` `GET /deliverable-shapes`.
- **Gate:** replace `ev > 0` with: the terminal's producing task's `resolver` is in the live discovery set, **or** the composite's VPM `successful_executions > 0` with a reached trace. Never admit a shape whose producing resolver is absent from `/registry/shapes`.
- **Builder:** (b) dispatched goal. activity-api routes are outside the 27 excluded paths, and this is the open gap's `edit_site`.
- **Verification:**
  - positive control: `obsidian:write_note` disappears from the response;
  - must-fail control: `memoryNote_write` (17 learned terminals, live producer) stays;
  - replaying goal_hash `a30a893c` inference returns no target without a discovery producer.
  - Give the open gap this machine-checkable falsifier in place of `"none"`.
- **Already in:** gap `goal-target-inference-proposes-a-terminal-shape-no-producer-serves`; §2.0b "inference reads descriptions" (adjacent). This proposal **extends** them.

### P2. Pick-time resolver liveness, with "not registered" as a deterministic demotion
- **Seam:** goal-host pick paths (b) and (c), and the `discover-by-shapes` admission in `activity-api services/discover-by-shapes.ts`.
- **Gate:**
  - reject a candidate any of whose `tasks[].resolver` is neither live in discovery nor a known in-process resolver;
  - apply `isIrrelevantLearnedComposite` (the proven-bad posterior test) on path (c) exactly as on path (b);
  - an engine failure `Resolver X is not registered` writes `retired_reason:"resolver_absent"` through the §4.2 retire primitive (step 2 extension) and is not left as a β tick.
- **Builder:** (a) for goal-host index.ts (excluded). (b) for the discover-by-shapes filter and the retire writer, which are in activity-api.
- **Verification:**
  - positive control: replaying the goal never executes the problem-detection template;
  - must-fail control: a fixture composite whose task resolvers are all live (for example web_search → llm_completion) is still picked;
  - a 2.1 row asserts that path (c) refuses a candidate with n ≥ 12 and ratio < 0.15.
- **Already in:** §3.4 "in-flight recovery loop and re-route arm" and §4.2 step 2 (retired/deprecated honoured on every pick path). The unregistered-resolver criterion is **new**.

### P3. The capability-gap filer checks the live address and counts by need, not by invented name (the §2.0b counter)
- **Seam:** `fileCapabilityGap` / `fileReachabilityGap`.
- **Gate:**
  - check "already served" against `liveShapes()` (discovery), not against `fetchKnownShapes()`;
  - drop the `obsidian:` prefix skip;
  - key demand by a **need signature**: the existing `goalClassTokenOf` / near-miss cluster from failure memory × the target's nearest advertised family. The invented shape name must not be the key.
  - Emit one route-around record per walk when a target is missing and the walk falls back.
  - Threshold held as a shape, as §2.0b specifies. Crossing it files an encapsulation goal.
- **Builder:** (a) for the goal-host emitter and filer. (b) for a generator in a non-excluded vessel (boredom-vessel or development-vessel already host gap ticks).
- **Verification:**
  - positive control: re-scoring the gap store's 850 capability rows with the new key merges `news / news_content / news_data / headlines / headlines_summary` into one need with demand ≥ 2;
  - must-fail control: two unrelated single-goal shapes stay at 1;
  - the journal shows 0 `already served: obsidian:write_note`.
- **Already in:** §2.0b (route-around record + counter + threshold → encapsulation goal; c11 named as the organ to extend). Re-keying by need is the concrete wiring fact §2.0b leaves open.

### P4. The date is available at synthesis and at judgment
- **Seam:** the reach-judge and synthesis prompt builders in goal-host. A shaped `currentTimeReport` should come from an existing producer.
- **Law 3:**
  - Do **not** finish clock-vessel. It is plain files, not authorable, and has no unit. Finishing it would need submodule-ising first (§7 step 9 / authorability).
  - The time is available today through local-tools `shell`/`bash` (`date -u`) or the substrate's own clock in goal-host. Register a `currentTimeReport` resolver in a submodule vessel that already serves deterministic primitives (local-tools-vessel). That is a three-place registration, not a new vessel.
- **Builder:** (a) for the judge injection, which is goal-host index.ts. (b) for the local-tools resolver.
- **Verification:**
  - positive control: replaying `cea3f4a4`'s attempt-2 artefact through the judge grades it reached;
  - must-fail control: the fabricated "June 7, 2024" artefact grades hollow.
- **Already in:** the open gap `reach-judge-and-synthesis-lack-the-current-date…`. The resolver placement is **new**.

### P5. Shape descriptions are durable and checked before inference reads them
- **Seam:** discovery `learnedDescriptions` (in process memory), the auto-describe tick, and §2.0b's "inference reads descriptions".
- **Gate:**
  - persist learned descriptions in an advertised shape (or the discovery store) so a restart does not drop them;
  - describe `_write` verbs (the delivery surfaces) instead of skipping them;
  - admit a learned description only if a deterministic check finds it consistent with the producing resolver's file and with the activity descriptions that declare the shape. Foreign-domain lines like the ≥21 above are refused.
- **Builder:** discovery is excluded, so (a). (b) for the tick script, but `scripts/substrate` is excluded too, so in practice (a).
- **Verification:**
  - positive control: after a discovery restart `/registry/shape-descriptions` returns ≥ the pre-restart count;
  - must-fail control: a planted "maritime" description for `vessel_exercise_scan` is refused.
- **Already in:** §2.0b names the 312 descriptions as the input. The volatility and the quality gate are **new**. They are a precondition §2.0b does not state.

### P6. FAILURE-RECALL reaches selection, not just prose
- **Seam:** `recallGoalFailures` consumers.
- **Gate:**
  - an exact-hash record whose `pick` failed ≥ 2 times adds that pick to the walk's initial `exclude` set;
  - structural reasons ("missing shapes … no producer", "not registered") are recorded instead of being filtered out at `:4155`, and they feed P3's need counter.
- **Builder:** (a).
- **Verification:**
  - positive control: dispatch 3 of `a30a893c` does not run the problem-detection template;
  - must-fail control: a goal with one LLM-judged failure keeps its pick.
- **Already in:** failure memory (`9e23455`, 09-22). Its extension to selection is **new**. It overlaps with P2, so build P2 first.

**Order.**
1. P1 (b) and P4's judge date (a) first. Together they remove both independent blockers to a reach for this class, after which the existing ribosome path can earn the composite.
2. Then P3, the §2.0b counter keyed by need.
3. Then P2 and P6 (selection hygiene).
4. P5 before any change that makes inference read descriptions.
