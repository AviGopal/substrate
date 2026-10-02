# Agentic floor, track C: from a reached chain to a reusable activity, and reuse next time

2026-10-01, read-only. Nothing was dispatched, written, restarted or committed to produce this file.

**Sources.**
- Live goal-host source: `/vessels/goal-host-vessel/src/index.ts` in `substrate-live`. Its md5 `23ea6654…` equals `origin/dev` `76bb373`, so goal-host line numbers below hold for both.
- Other code at `origin/dev`: ribosome-vessel `5a374df`, ias-executor-ts `c563ab5`, activity-api `2d304bc`, development-vessel `a2f3e2ea`.
- SurrealDB `activity-system/learning_loop`, read only.
- The goal-host and ribosome-vessel journals. Both begin **2026-09-26 11:22Z**.
- The live gap store `/workspace/git/super-repo/gaps/gaps.json`.

**Three windows. Every number names one of them.**
- **[SQL-7d]:** the `execution` table, `created_at > now − 7d`, read about 2026-10-01 16:00Z. The table is retention-bounded: 149,974 of its 150,035 rows fall inside the 7 days.
- **[J]:** the journals, 09-26 11:22Z to 10-01 16:17Z, about 5.2 days.
- **[PATH-life]:** `goal_execution_paths` rows last executed in the 7 days. Their counters are lifetime totals, not totals for the window.

---

## 0. Summary

1. **Extraction is alive again, and the dossier is stale on this.**
   - `dossiers/composition-crystallization.md` §4 (09-29 05:00Z) says 0 `reached:true` extractions and no mint since 09-22.
   - Substrate-authored `c546ec9` and `784a162` (activity-api, 09-29 16:21Z and 16:27Z) re-pointed the trace-signature point lookup at the live `execution` table.
   - The first full 7/7 `ribosome-extract` run followed at **16:39:52Z** (`exec_g8wmvbqs`).
   - Since then: **145** full runs [SQL-7d] and **14** new `learned-*` rows, the first at 09-30 02:16Z.
   - `severed-joint-ribosome-extraction` is still **open**. The detector has no close-on-recovery path.
2. **The floor is structurally unextractable today.**
   - [SQL-7d]: 1,823 floor executions, **all with 0 tasks**, 303 of them reached.
   - goal-host's floor does not call `mintReachedTrace` at all.
   - ribosome-vessel requires `completed > 0` (`ribosome-vessel index.ts:321`), so every floor reach is skipped. Its journal shows 22 of 22 floor reaches as `completed=0` [J].
   - Result: 0 extractions from floor traces and 0 composition edges touching the floor.
3. **"The ribosome mints nodes, not edges" holds at HEAD, and it is worse than that.**
   - 0 of 515 non-deprecated `learned-*` templates carry any `dependencies` or `inputImpulses`.
   - The synthesis prompt's task schema has neither field.
   - Edges survive only implicitly, through per-task `inputShapes` bound by shape in array order (`ias-executor engine.ts:631`).
   - A 2-task composite trace with linked impulse ids (`walk-composite-federation-verification-report-to-vessel-health-report-7inwqk`) became a **1-task** template.
4. **Two extraction owners apply two different gates.**
   - goal-host refused 24 reaches as ungrounded [J].
   - ribosome-vessel still dispatched extraction for 16 of those 24, and 5 were written as templates. Example: `exec_cc2wv10y`, refused at 10:39:58Z, written as `learned-activity-auto-mint-learned-topology-snapshot` at 10:40:39Z.
   - 12 of the 14 new rows carry `goalSignature: null`, which is the ribosome-vessel owner's signature.
5. **Reuse means "run the floor again" for most borrowed pathways.**
   - Floor reaches record the **requested** targets as their completion shapes: literally in the `completion_shapes:` tag (`index.ts:5565`), and via the judge's own `verdict.completion_shapes`, which echo the requested list, into `recordGoalPath` (`:5615` → `:13547`). For example, `memoryNote_write` appears 38 times [SQL-7d], although the floor never produces it.
   - Those requested targets become `endpoint_output_shapes`.
   - The shape-signature borrow (`activity-api goal-paths.ts:1052-1090`) then lends floor-only pathways to any goal with ≥0.5 cover.
   - [J]: 294 accepts came via `shape_signature` against 130 via `goal_hash`. 109 were floor shortcuts, 65 of which did not reach.
6. **The ratchet turns only on self-maintenance.**
   - [SQL-7d]: 41 reached executions of `learned-*`, every one carrying a self-maintenance operator tag.
   - Part of that reach is graded on a receipt: [J] logged 79 content lines whose whole body was a 128-char `{"producedBy","executionId"}`, and 7 of them were counted as `REACH-CONTENT`.
   - 0 of the 14 new rows came from a human-surface or web-search→answer goal.
7. **Vocabulary is not earned at extraction. It is copied.**
   - `output_shapes` is the union of the trace's per-task shapes.
   - Names are derived from the parent id or from a goal slug (`composedDeliverable_<slug>`, 93 activities).
   - `human_presentation` exists, but only as a post-reach pool projection (`index.ts:11466`). It is never a chain step, so 0 templates output it and `/deliverable-shapes` can never see it.
8. **First- and last-mile adaptation at HEAD is command-grain only.** It covers lexical rebind, the reached-command cache, and title binding. Template-grain binding of different inputs into the same body does not exist (§4).

---

## 1. Prior art (before any proposal)

The class record `classes/composition-crystallization.json` holds 91 attempts, 19 problems and 13 claims. The dossier §1–§5 is the narrative. Neither is re-narrated here. Below, grouped by this track's questions, is what each attempt tried, what happened, and whether it held. Hashes come from those records unless marked **[new]**.

| Theme | Attempts (what was tried) | What happened | Held? |
|---|---|---|---|
| **The extractor exists** | Ribosome built 4 times: microplastic `e5b04851` 03-27, activity-api `57e92c06`, ribosome-vessel `3a3ef840`, goal-host reach→mint `15620e7`/`892c342b` 06-22 | Duplicate owners from then on (mech chunk 15). goal-host's `mintReachedTrace` was found to duplicate the WS path (git-small) | **No.** Two owners are live today, with different gates (§3.2) |
| **Reach→mint actually writes** | `f88ba8f` status `'completed'`, `ff292c6` msg nesting, `572cd6c` durable census, `5f96ba4` `applyExtraction`, `8d960a8`/`f3c7028`/`62acd51`/`fc559be` composite 4 defects, `11859d57` writer/reader table | Each said "the previous path never minted". 436 `learned-*` by 08-25. Dead again 09-22 → 09-29 via the view | **Partially.** Revived 09-29 by **[new]** `c546ec9`/`784a162`. Dossier root cause 1 (the extractor reads through an address other work keeps moving) is unchanged |
| **Honesty gate** | `8d969b4` `isHonestlyReached` (07-21), `411417b` grounded mint (07-23) | Hollow templates fell from 374 to 2. Eligibility starved | **Only on the goal-host owner.** ribosome-vessel reads `reached` only (`index.ts:385`), so it bypasses the gate on 5 of 24 refused reaches [J] |
| **Extraction copies faithfully** | config:{} saga across 5 layers (`0bbd488`…`f71bb56`), rule 9a input_shapes (`a56fe27`), `d1bb036`/`8b88856` shapes from tasks, `27cc619` composite inputShapes | Configs restored. 9a was inert for 11 days on a stale dist. `[redacted]` placeholders were destroyed (09-24) | **Fields yes, structure no.** Edges were never copied (§3.3). A 2→1 task collapse is observed |
| **Floor feeds the learned store** | `550ce23` floor-records-only-its-wins (site 1). Floor reach `recordGoalPath` (the "0 of 4,768 path rows" fix, `index.ts:13531-13550`). 08-09 completion_shapes-on-floor fix (`index.ts:5554-5565`). 08-28 `_floorCompletionShapes` | Floor paths became retrievable | **Over-held.** Tagging the *requested* targets made the paths retrievable, and also made them borrowable by unrelated goals (§4.3) |
| **Minted copy of the floor** | Gap `minted-copy-of-the-floor-shadows-the-floor` (memory-8 N69, 08-08). The ribosome minted `learned-universal-tool-fallback`, 3/32 | chunk-27 (09-29): "No `learned-universal-tool-fallback` row exists any more" | **Deleted, by an unrecorded mechanism** (§3.5). 0 commits touch the name in 6 repos. The gap is not in the live store. The shadow is **latent** |
| **Pathway replay** | `recommendReachingPath` + Wilson `785293c`, `?? null` `86a776d`, satisfier-head six layers (`3d2e52a`, `579f365`, `c37df24`, `9c376b2`, `249ff89`, dev `dac3c2c`), floor-as-pathway shortcut | learned_pathway 58.5% vs fresh 1.3% (dossier §4). 20/20 on one product family (09-23) | **Yes, instance-keyed.** 4 related gaps are still open (`a-learned-pathway-whose-head-is-a-satisfier…` and its recommit, `the-walk-runs-the-terminal-write-satisfier-before-any-producer…`) |
| **Shape-keyed reuse** | Re-key by `path_signature` (found 09-05 and 09-16, not landed). `shape_signature` borrow `9c376b2`. 1,644 pathways made addressable (09-06) | The borrow is live. Reuse rate did not move on 09-06 | **Wrong key.** It borrows on `endpoint_output_shapes`, which for the floor are *requested* shapes (§4.3) |
| **Middle tier** | Lexical rebind `d38eaa9`/`831dafb`. ~12 fixes on 08-08. Threshold lowered 0.5→0.25→0.15 (refused at the third lowering). 09-11 `cd011e3`/`d8b1d92`/`abb07ea`. 09-18 `6eed100`/`4c5534d`/`2e8b4cc` | 09-18 "Proven" retracted (rebind 0/146) | **Command-grain only.** [J] REBOUND 133 (activity_metrics 62, shellResult 69), REUSED 59 |
| **Composition edges** | 12 causes on one function (`cf5370e8`…), ingest-time derivation `516fc73` | 15,319 edges; 3,659 updated in 7d; 7,108 touch `learned-*` | **Yes for engine and walk traces.** **0 edges touch the floor** |
| **Vocabulary** | `2c91aaf`/`6082c2e` `/deliverable-shapes` (07-31). `df174dbf` `deliverableShape()` → `composedDeliverable_<slug>` (06-27). `a72ad1a` `human_presentation` on reach (07-26). Auto-describe tick `8edd8619`/`b123b8e` | Track 3 (`output-shapes/3-vocabulary-and-earning.md`): the gate is vacuous (`ev>0`, 639/639 at 0.5); descriptions are volatile; `human_presentation` is not advertised | **No.** Covered in §6, which adds the extraction-side seam |
| **Detection** | Joint-liveness `70254535` (09-27) | Filed `severed-joint-ribosome-extraction` on 09-28 | **Detects but never closes.** Still open after the revival |

Prior attempts at **floor → extraction** specifically: none. The floor has fed the pathway store (`recordGoalPath`) since `550ce23`. It has never fed the template store, except by accident through the WS path, which produced `learned-universal-tool-fallback`.

---

## 2. Corrections to the existing records

1. **Dossier §4 "Minting is dead … 0 since 09-22" is superseded.**
   - Revived 09-29 16:39Z by substrate-authored activity-api `c546ec9` + `784a162` (`src/routes/execution-trace-with-signatures.ts:506-532`). They point-read `FROM type::thing("execution", $executionPointId)` instead of the legacy view.
   - 145 full runs [SQL-7d], 0 of them before 16:39Z on 09-29.
2. **chunk-27 #1 "minted copies partly resolved" should read "deleted; the cause is latent".** See §3.5.
3. **Dossier §0 "the middle tier is dead (0 of 377 selected)" needs a qualifier, not a reversal.** [J]: `[rebind] result … selected=true` 195 and `REBOUND` 133 (activity_metrics 62, shellResult 69), while the per-call `outcome selected=` line reads `no` 2,560 times. The dossier counted 14 `selected=true` lines, "none of them organic". The two shapes that rebind fires on match the trend-expectation fixture families. Whether any of the 133 are organic was **not checked**, so the dossier's qualifier may still hold.
4. **Collector claim: the 09-18 "Proven" crystallization is template extraction.** It is not. It was the **reached-command cache** (`index.ts:4156-4167`, `:8525-8528`): a node-local jsonl, now 10,836 lines. Track 3 and the dossier both say so, and this report keeps the two grains apart.

---

## 3. Q1: Ribosome extraction at HEAD

### 3.1 Two owners, one template

| | goal-host `mintReachedTrace` (`index.ts:7089-7194`) | ribosome-vessel `onExecutionCompleted` (`ribosome-vessel src/index.ts:287-410`) |
|---|---|---|
| Trigger | Three call sites: walk reach `:11723`, walk composite `:11778`, single-template recovery reach `:14416`. **Not the floor** (`:5295-5620` has no call) | WS `execution_completed` plus a reach re-read of the trace row's `reached` column (`:453-466`, `:616-640`) |
| Reach precondition | `grounded` = `isGroundedHonestReach(verdict, {commandEvidence, consumedInChain, editEffectReach})` (`:11720`). For composites: `mintGrounded` **or** ≥2 tasks with output impulse ids (`:11749`) | `reached === true` from the column or tag only. No grounded check |
| Other gates | `unaccounted_landing_scan` defer (`:7093-7110`). Depth: count of `learned-` ≤ `extractionPolicy.maxExtractionDepth` (fallback 1; a code comment says the policy has no producer. Journal [J]: ribosome-vessel logged `extractionPolicy unresolved` 363 times, goal-host 0 times, so the two owners may not even read the same bound) (`:7143-7150`). **Trivial skip:** `tasks ≤ 1 && compositionChain.length === 0` (`:7156`) | Recursion: producer starts with `ribosome`. Same depth bound. **`allSucceeded = failed===0 && completed>0 && allTerminal`** (`:321`). Ungradable-producer list (`:173-189`). Dedup set (`:97-112`) |
| Lifecycle passed | `outputShapes` = union of task outputShapes, `taskCount`, `depth`, `impulseCount`, **`goalSignature`**, `templateAuthor` derived from the `learned-` prefix | **`outputShapes: []`, `hasGoalContext: false`, `goalSignature: null`, `templateAuthor: ""`** (`:391-407`) |
| Executes | `host.runGoal(…, {targetTemplateId:"ribosome-extract", applyExtraction:true})` in-process | POST goal-host `/run-goal` with the same target, tagged `ribosome-vessel-dispatch` |

The template is `ias-executor-ts src/templates/lifecycle/ribosome-extract.json`. It has 7 tasks:
1. `acquire_trace_signature` (`:53`): a point resolve of `executionTraceWithSignatures`, gated on `lifecycle.qualityEligible`.
2. `assess_quality`: an LLM task, gated on the signature containing `"tasks"`. Its rubric scores on task count (2–3 → 0.7, 4–6 → 0.85 …), resolver tier mix, cost and depth. Its hard gates are recursion and status `completed`. It is told to judge structure only, because "the trace signature … does NOT carry the output content".
3. `synthesize_template` (`:104`): an LLM task that writes the JSON (rules below).
4. `validate_proposal`: an LLM task.
5. `dispatch_write_attempt` (`:159`): `activityTemplate_write` `operation:create`, gated on `applyExtraction`.
6. `dispatch_write_succeeded`: noop.
7. `emit_summary`.

**What `synthesize_template` mints.** The rules are in the prompt text, and an LLM executes them:
- `id`: `learned-<parent-slug>`, truncated to 60 characters, deterministic, "so the write UPSERTs". **The rule is enforced only by an LLM.** Live example: parent `satisfier:substrateGap` was minted as `learned-satisfier-substrategy`.
- `name` from goal context.
- `description`: "1-2 sentence summary of what the chain does", written from a signature that carries no content. Example: "A learned activity template that writes a memory note."
- `tasks[]`: `{id, description, resolver (verbatim), config (verbatim), inputShapes, outputShapes}`. **The schema has no `dependencies`, `inputImpulses` or `outputImpulses`.** Contrast development-vessel `author-composed-capability.ts`, whose authoring schema *does* ask for `outputImpulses` and `dependencies`.
- `input_shapes` (rule 9a): external inputs only.
- `output_shapes` (rule 10): "exactly `lifecycle.outputShapes`". That value is `[]` on the ribosome-vessel path, so there it is left to the LLM.
- `metadata.{extracted_from, sourceExecutionId, sourceTemplateId, goalSignature}`.

### 3.2 Measured [SQL-7d, J]

| Measure | Value |
|---|---|
| `ribosome-extract` runs | 873 |
| Full 7/7 runs (template written or upserted) | **145**: 122 ribosome-vessel, 23 goal-host. First at 2026-09-29T16:39:52Z |
| Hollow vector `[success, skipped×6]` | 672 |
| Runs by source trace class (all / full) | satisfier trace 420 / 78; walk composite 352 / 52; engine template (`exec_*`) 80 / 15; feature_compose 12 / 0; **floor 0 / 0** |
| New `learned-*` rows since 09-22 08:00Z | **14**, all from 09-30 02:16Z on. The other ~131 full runs upserted existing deterministic ids |
| New rows by origin | 7 single-satisfier traces (`learned-satisfier-*`); 3 walk composites; 4 engine/learned parents (2 of them `learned-learned-*`); **0 floor**; **0 human or web-search goals** |
| New rows by owner (via `metadata.goalSignature`) | 12 `null` (ribosome-vessel path); 2 with a signature (goal-host path) |
| goal-host `reach→mint: ran` / `SKIP ungrounded` / `SKIP trivial` / `DEFER` [J] | 94 / 24 / 0 / 0 |
| Ungrounded reaches extracted anyway by ribosome-vessel | 16 of 24 dispatched, **5 written**. Example: `exec_cc2wv10y`, SKIP at 10:39:58Z, written as `learned-activity-auto-mint-learned-topology-snapshot` at 10:40:39Z |

goal-host's composite comment says not to mint single satisfier traces (`:11724-11728`). ribosome-vessel mints them anyway: 7 of the 14 new rows are single-satisfier.

### 3.3 "Nodes, not edges", verified

- **Template grain.** Of 515 non-deprecated `learned-*` rows, **0** have any task `dependencies` and **0** have `inputImpulses`. The engine runs tasks in array order and binds each one's declared `inputShapes` from the pool by shape (`engine.ts:631`), or through `{{placeholder}}` scans (`:636-660`). Data flow is therefore *implicit*: by order, plus shape-name equality.
- **Collapse.** The composite trace `…-7inwqk` has 2 tasks. Step 2's `input_impulse_ids = ["walk-federation_verification_report-5"]`, which is step 1's output. The minted `learned-composition-federation-verification-report-to-vessel-health-report` has **1 task** (`vessel_health_report`, inputShapes []).
  - Across `learned-composition-*`: 23 rows with 0 tasks, 6 with 1, 119 with ≥2. In September, 4 of 33 have 1 task.
  - **Where the collapse happens is unverified.** The synthesized impulse (`dev:llm_completion_dispatch_kbl0pnah`) is not persisted, so the LLM output cannot be read back read-only.
- **Activity grain.** Edges are a separate organ: ingest-time `activity_composition_graph` (`516fc73`), with 15,319 rows, 3,659 updated in 7d and 7,108 touching `learned-*`. **0 touch `universal-tool-fallback`.**

### 3.4 The floor's trace, as the extractor sees it

Persisted at `index.ts:5528-5592`:
- `templateId: "universal-tool-fallback"`, `compositionChain: []`, `inputImpulseIds: []`, `outputImpulseIds: []`.
- `tasks[]` = client-side tool calls only, each with `outputShapes: []` and no config.
- The `completion_shapes:` tag = **requested** `targetShapes` (`:5565`).
- `metadata.final_text` capped at 4,000 characters (`:5590`).

Measured [SQL-7d]: 1,823 rows, **1,823 with 0 tasks** (the agentic wrapper runs the tools), 303 reached. Final text: median 1,664 characters; 10 of 303 exceed 4,000.

Completion shapes on reached rows:

| Completion shapes | Rows |
|---|---|
| `["memoryNote_write"]` | 38 |
| `["shellResult","memoryNote_write"]` | 25 |
| `["reachability_gap_repair","capability_gap_audit"]` | 18 |

None of these was produced by the floor.

Extraction outcomes:
- **ribosome-vessel:** 22 of 22 floor reaches log `completed=0` and do not dispatch [J].
- **goal-host:** no call.
- Even if a floor trace were dispatched, `assess_quality` would mark a 0- or 1-task trace ineligible ("zero or one task (nothing to compose)"). goal-host's trivial skip (`:7156`) would also fire, because `compositionChain` is `[]`.

### 3.5 `learned-universal-tool-fallback`

- **Current state:** 0 `activity` or `activity_template` rows match `universal-tool` (deprecated included). 0 `variant_performance_metrics` rows exist for it. The real floor's arm is Beta(829.4, 7006.2). 0 commits in 6 repos touch the string, and the gap is absent from the live store. **The row was deleted; there is no record of who deleted it or why.**
- **Why it does not re-mint today:** only because the floor's `taskCount` is 0.
- **Why it would come back:** the id rule is `learned-<parent-slug>` and the parent is always `universal-tool-fallback`. The first floor reach that runs ≥1 client-side tool (taskCount > 0 passes `:321`) would mint the slot again. Every floor goal, whatever its topic, would then UPSERT into **one** template. That is the shadow, by construction.
- **Bearing on track B:** track B's goal ("every call visible to goal-host") is exactly what re-arms it.

---

## 4. Q2: How the next walk finds and reuses it

| Mechanism | Where | Key | Grain | Measured [J] |
|---|---|---|---|---|
| Reached-command cache (exact replay) | `index.ts:4156-4167` (store), `:8525-8528` (use) | `goalHashOf` (`goal-target-inference.ts:28-40`: NFC + lowercase + whitespace collapse + trailing punctuation) | One command arg | `REUSED verified command` 59 (docs_align_tick 20, substrate_health_tick 12, …). The node-local file has 10,836 lines |
| Lexical rebind (Tier-2) | `tryLexicalRebind` `:4319-4555`; use at `:8533-8537` | Same-shape donors; the varying span must appear literally once | One command arg | REBOUND 133; `selected=true` 195; per-call `outcome selected=no` 2,560 |
| Family recipe | `recipeCommandFor` `:4838`, use at `:8529` | Goal class | shellResult command | 0 |
| Pathway retrieval | `recommendReachingPath` `:6827-6884` → activity-api `/v2/goal-paths/recommend` (`goal-paths.ts:916-1245`) | Exact `goal_hash` first. If no exact path has ≥3/5, the **shape-signature fallback**: `endpoint_output_shapes CONTAINSANY target_shapes`, cover ≥0.5 (`:1052-1090`). Proven-failing (0 successes in ≥3 runs) withheld (`:1010-1016`) | Ordered activity list | Accepted 424: goal_hash 130 (1/2/3-step 103/21/6), shape_signature 294 (199/93/2). "0 accepted" 222 |
| Pathway use: floor shortcut | `:13213-13250` `floorIsTheProvenPathway` (exactly `["universal-tool-fallback"]`, not edit, not durable artifact) | Any accepted pathway, **including a shape-signature borrow** | Whole goal | 109 shortcuts, 65 not reached → 44 `recordGoalPath (floor REUSE)` |
| Pathway use: pin head | `pinnableHead` (`pathway-head.ts:55`) | The head, unless it is a satisfier or the floor | First step | — |
| Pathway use: step preference | `pathwaySet` `:7462`; `REUSE-BEFORE-DERIVE — picked` `:10603-10610`; satisfier variant `:10075-10084` | Membership of the candidate id in the pathway | Tie-break among candidates | 1 pick; 0 satisfier picks |
| Backward chain over output shapes | `:10638-10680` → `discover-by-shapes` `required_shapes: missingTargets` | Declared template `output_shapes` vs the walk's targets | Template | This is how a learned template is found without a pathway. It needs a target that names its output |

**First- and last-mile adaptation at HEAD**, against the CLAUDE.md definitions:
- **First mile** ("bind different inputs into the same body") exists only at command grain:
  - lexical rebind swaps a literal span in a shell command or SQL (`:4319`);
  - the reached-command cache replays on a `goal_hash` hit.
  - **Nothing binds new input impulses into a learned template body.** `recommendReachingPath`'s return was widened to the full activity list (comment at `:6770-6776`: "first-mile binding … last-mile carry … had nowhere to go"). The walk uses that list only as a tie-break set and a head pin.
- **Last mile** ("carry the same body's outputs to a different target shape") exists only as `COMPOSED-WRITE TITLE BINDING` (`:8586-8592`, a title for a `_write` shape) and as the terminal-output bridge to note sinks (`:11473+`). No code takes a pathway's terminal and walks the remaining shapes to a different target.

### 4.3 The floor feedback loop

1. A floor reach is recorded with `endpoint_output_shapes` = the **requested** targets. The `:5565` tag holds the requested list literally. `:5615` `_floorCompletionShapes` takes the judge's `verdict.completion_shapes` (which the judge picks itself and which echo the requested targets; see the `recordGoalPath (floor reach) shapes=` journal lines, for example `[code_modification_proposal, test_report_write, memoryNote_write]`) and `:13547` `recordGoalPath` records that.
2. The next goal's inferred targets overlap those shapes. Inference guesses targets (track 1), so they often do.
3. The shape-signature fallback lends the floor-only pathway.
4. `floorIsTheProvenPathway` is true, so the walk is skipped and the floor runs from scratch. 65 of 109 times it did not reach.
5. The re-run records `learned_pathway` on success (`:13229`). The "ceiling" tier is therefore partly the floor re-labelled.

[PATH-life]: 470 floor-only paths, 529/9,167 lifetime reached. The `learned_pathway` tier has 535 paths at 403/617.

---

## 5. Q3: The ratchet, measured

Chain: reached → extracted → template → later selected → reached again.

| Origin | Reached [SQL-7d] | Extraction runs / full [SQL-7d] | New rows (since 09-22) | Executions of learned rows from this origin [SQL-7d] | Reached again |
|---|---|---|---|---|---|
| Walk composite (`composition:*` / `walk-composite-*`) | 177 / 178 | 352 / 52 | 3 | part of 5,252 | **28** (memorynote→memorynote_write 8, project-thread-scan→memorynote_write 7, llm-completion-dispatch→concept-write 6, topology/health-tick pair 4+2, filecontent→shellresult 1) |
| Single satisfier (`walk-satisfier-*`) | 436 / 6,945 (5,709 ungraded) | 420 / 78 | 7 | part of 5,252 | **13** (memorynote-write 5, substrategap-write 3, learned-learned-…federation 2, 3 others 1 each) |
| Engine template (`exec_*`) | — | 80 / 15 | 4 | — | 0 from the 4 new rows |
| **Floor** | **303 / 1,823** | **0 / 0** | **0** | — | — |
| feature_compose | — | 12 / 0 | 0 | — | — |

All `learned-*` together [SQL-7d]: 162 of 525 ids executed; 5,252 executions; **4,944 ungraded (94%)**, 267 false, **41 true**.

**Who the 41 served.**
- 39 of 41 carry a self-maintenance tag: `operator:trend-expectation-check` 24, `operator:rhythm-conductor-drain` 10, `escalated_from:<gap>` 3, `operator:expectation-scan` 1, `boredom_autonomous` 1. The other 2 carry no operator tag. 0 carry a human-surface tag.
- 0 human-surface; 0 news or web-search goals.
- The one web-search composition, `composition:websearchresult-to-memorynote-write`, reached once and is not among the new rows.

**Receipt contamination.**
- [J]: 79 `REACH-CONTENT` / `HOLLOW-CONTENT` lines carry, as the *entire* produced content of a learned template, the 128-char receipt `{"producedBy":"activity:⟨learned-…⟩","executionId":…}`. 7 of those 79 were counted as `REACH-CONTENT`.
- Example: Sep 30 10:39:58, `learned_topology_snapshot`. The same composite produced 279,200 characters at 04:31.
- **So 41 is an upper bound.** The walk's judge digest `poolDigest` (`:11036-11056`, passed to `verifyGoalReached`) has **no** `isBookkeepingOnly` filter, while the single-template path applies one (`:14387-14394`). The `REACH-CONTENT` / `HOLLOW-CONTENT` labels (`:11327`, `:11366`) echo the verdict for each completion shape. So the 7 lines show the judge naming as a completion shape one whose only pool content was a receipt. They do **not** prove that the receipt alone decided the reach: at 10:39:58 the chain had 5 steps.

**Positive control (template grain, same address).**
- `learned-composition-memorynote-to-memorynote-write` was extracted 08-29 from `walk-composite-memorynote-to-memorynote-write-bsosuu` (`metadata.extracted_from`). In [SQL-7d] it was selected 129 times and reached 8 times (trend-expectation-check).
- The chain does turn, and the store and tags are readable at this address. So the floor's zeros above are real absence, not a misread.
- The command-grain control is §4 (REUSED 59 [J]).

**Against the dossier's retire condition §7.2** (≥1 `learned-*` per day with `extracted_from` → `reached=true`; ≥1 per week from a non-self-maintenance goal):
- Daily: met on 09-30 and 10-01.
- Weekly non-self-maintenance: **not met** (0 of 14).

---

## 6. Q4: Vocabulary earned at extraction

What names a reached chain's terminal today:

| Path | Name source | Example | Becomes a target? |
|---|---|---|---|
| Walk composite | `buildCompositeTraceFromChain` slug = ordered shapes joined with `-to-`, cut at 64 (`:7022-7028`) → `composition:<slug>` → `learned-composition-<slug≤60>` | `learned-composition-federation-verification-report-to-vessel-health-report` | Only if its terminal is already a known shape |
| Single satisfier | `satisfier:<shape>` → `learned-satisfier-<shape>` | `learned-satisfier-substrategy` (an LLM mangling of `substrateGap`) | Same |
| Composed capability (dev-vessel) | `deliverableShape()`: first inferred target, else `composedDeliverable_<goal-slug≤40>` (`author-composed-capability.ts:308-315`) | 93 activities output `composedDeliverable_*` | **No.** `/deliverable-shapes` deny-regex `^composedDeliverable_` (`activities.ts:1250`) |
| Floor | `learned-universal-tool-fallback` (one slot) | — | No |
| Descriptions | Template: written by an LLM from a content-free signature. Shapes: the auto-describe tick, held in discovery process memory only (track 3 §1.1) | — | goal-host reads 0 descriptions (track 3) |

**Output shapes are copied from task `outputShapes`, never named from evidence.** No step looks at the reached content, the goal class or the consumed inputs and names the deliverable.

**How a news-report deliverable could be named without minting (law 3):**
1. **The shape exists.** `human_presentation` is built by `buildHumanPresentation` and added to the pool at `index.ts:11466`, *after* the verdict, as a projection of `poolDigestHuman`. It is not a walk step, so no chain has it as a terminal, no trace task outputs it, and 0 templates do. The floor does not emit it at all (it returns `answerBody`, `:5616`).
2. **What it needs.** It must become the **answer step**: a recorded chain step with `outputShapes:["human_presentation"]` whose `input_impulse_ids` consume the evidence impulses (`webSearchResult`, …), and whose content is the answer itself, dated and judged at full length.
3. **What then happens with no new organ.** `buildCompositeTraceFromChain` (or the floor's equivalent) gives the task that output shape. The ribosome copies it to `output_shapes` and computes `input_shapes=[webSearchResult]` by rule 9a. `/deliverable-shapes` (`activities.ts:1240-1275`, which reads only `tasks[*].outputShapes` of `learned-`/`composed-cap` rows) counts it as a terminal. `fetchKnownShapes` then admits it to inference.
4. **Description from evidence.** The need signature (goal class plus consumed input shapes plus the reach date) belongs in the template's `description` and metadata, written from the trace that reached. The *shape* stays generic.
5. **Two traps track 3 P1 must account for:**
   - Its "live advertiser" test must accept an **activity producer** (a learned template, found through `discover-by-shapes`), not only a discovery-registry vessel. Otherwise `human_presentation` can never qualify, because no vessel advertises it.
   - A generic terminal plus cover-only matching recreates the floor shadow. Every question goal would borrow the news pathway at cover 1.0 (`goal-paths.ts:1056-1079`). Matching must also require that the pathway's `input_shapes` be producible for this goal. That is the first-mile check, and the start of the "hint, not gate" inference the design asks for.
6. **§9.0 applies.** Making `human_presentation` targetable makes an address resolvable. It must be substrate-local, behind route auth.

---

## 7. Q5: What extraction needs from the floor (the contract track B must satisfy)

These are the fields the existing builders and extractor already read, so track B's floor needs no new extractor.

| # | Field on the persisted floor trace | Read by | Today |
|---|---|---|---|
| 1 | `tasks[]` = **one per shape-resolve step**, `resolverId` = the shape resolved (re-executable through discovery), not a tool name | engine replay; `assess_quality` task count; ribosome-vessel census `taskCount > 0` (`:321`) | 0 tasks |
| 2 | Per task: `inputShapes`, `outputShapes` (the produced shape, never `[]`) | ribosome rules 7, 9a, 10; `/deliverable-shapes` terminal = produced − consumed | `outputShapes: []` |
| 3 | Per task: `input_impulse_ids` / `output_impulse_ids` = real pool impulse ids (the edges) | composite builder `:6997-7010`; ingest-time composition-edge derivation; the `compositeGrounded` predicate `:11749` | `[]` |
| 4 | Per task: `resolved_config` (the arguments actually sent) | rule 7 "config verbatim"; replay | absent |
| 5 | The answer step as a task: `outputShapes:["human_presentation"]`, consuming the evidence ids, content persisted in full (not `final_text` ≤ 4,000) and dated | §6; reach judge (track 4); delivery (track 5) | `metadata.final_text` |
| 6 | `compositionChain` = step execution ids; ≥2 steps for a composed answer | goal-host trivial skip `:7156`; lifecycle `depth` | `[]` |
| 7 | `completion_shapes` = **produced ∩ requested**, never requested alone, at **both** leaks: the `completion_shapes:` tag (`:5565`) and the shapes handed to `recordGoalPath` (`:5615` → `:13547`, today the judge's self-chosen list) | `recordGoalPath` → `endpoint_output_shapes` → shape-signature borrow | requested / judge-chosen |
| 8 | `reached` **and** `grounded` as trace fields both owners read (or one owner) | goal-host `:11720`; ribosome-vessel `:385` | grounded is in-process only |
| 9 | `templateId` that is **not** the constant `universal-tool-fallback`. Use the composite form `composition:<shape-slug>`, so the deterministic id keys on the chain, not on "the floor" | ribosome rule 1 (`learned-<parent-slug>`) | constant → one shadow slot |
| 10 | `goalSignature` (need hash) on the trace and the lifecycle | rule 8 intent back-edge; failure memory | goal-host path only |
| 11 | Failed steps as tasks with `success:false` and the step's error (route-around record) | §2.0b counter; `assess_quality` "failed tasks in the chain" disqualifier | absent |

The cheapest conforming emitter is to **reuse `buildCompositeTraceFromChain` + `mintReachedTrace`**, the walk's composite path, `:11745-11778`, from the floor. It already produces items 2, 3, 6 and 9 for walk chains. It does **not** produce config (item 4); `resolverId` is set to the shape; and it needs per-step pool impulses. That matches the design's step (2), "observe = an impulse added to the pool".

---

## 8. Proposals

Each proposal follows §1. Builders: **(a)** operator bootstrap, used for the goal-host `index.ts` and `goal-target-inference.ts`, discovery and `scripts/substrate`. **(b)** a dispatched goal. Change one thing per landing (law 12).

**C1. The floor emits the §7 contract through the existing composite builder.**
- **Seam:** `index.ts` `universalToolFallback` `:5526-5592`, calling `buildCompositeTraceFromChain` (`:6979`) and `mintReachedTrace` (`:7089`).
- **Gate (deterministic):** a pure check on the trace before persist. Every task has a non-empty `outputShapes`; ≥1 task has `input_impulse_ids`; `completion_shapes ⊆ produced`.
- **Builder:** (a).
- **Verification:**
  - positive: a reached floor run with ≥2 shape steps → `ribosome-extract` 7/7 → a template with ≥2 tasks whose `output_shapes` contains the answer shape;
  - must-fail: a bare-LLM floor answer (0 shape steps) → `SKIP trivial` / `SKIP ungrounded`, no row;
  - must-fail: no row id equals `learned-universal-tool-fallback`.
- **Already in** §2.0b (emitter) and the design's steps (2)–(4). **New:** the field contract (§7) and item 9, which pre-empts the shadow from re-arming.
- **Prior art:** `550ce23` and the 08-09 completion_shapes fix are the two prior floor→store wirings. The second introduced item 7's defect.

**C2. One reach-and-grounded gate for both extraction owners.**
- **Seam:**
  - goal-host stamps a `grounded:true|false` tag where it stamps `reached:` (`:5564`, `:11751`, satisfier persist);
  - ribosome-vessel `onExecutionCompleted` `:385` requires it;
  - or retire the WS dispatch path, as dossier §6 already lists, and as the code comment's gap `ribosome-extraction-subsumed-by-goalhost-mint-retire-decision` names.
- **Gate:** `reached && grounded` is read from the trace, never inferred.
- **Builder:** (a) for the tag; (b) for ribosome-vessel. Confirm against `autonomyScope.excluded_paths`.
- **Verification:**
  - must-fail: replay of the `exec_cc2wv10y` pattern (goal-host SKIP ungrounded) → no `ribosome-vessel-dispatch` run;
  - positive: a grounded composite → extracted.
- **Already in** REALIGNMENT §2.1 ("composition-crystallization: an input-contract row for the extractor") and dossier root cause "no single authoritative reach signal; duplicate extraction owners". Not new.

**C3. The extractor copies structure, and refuses when it does not.**
- **Seam:**
  - `ribosome-extract.json` `synthesize_template` (`:104`): add `dependencies` and `inputImpulses` from per-task `input_impulse_ids` to the schema;
  - compute `id` deterministically in a non-LLM task, or in the `activityTemplate_write` handler, rather than by prompt rule.
- **Gate:** in `activityTemplate_write` for `author: ribosome-pattern`, refuse when `tasks.length` ≠ the number of successful source tasks, or when `id` ≠ f(`sourceTemplateId`).
- **Builder:** (b), unless `ias-executor-ts` templates or the activity-api write route are excluded.
- **Verification:**
  - must-fail: the `…-7inwqk` trace (2 tasks) → a 1-task proposal is refused;
  - must-fail: `learned-satisfier-substrategy` is refused against `satisfier:substrateGap`;
  - positive: a 2-task composite → a 2-task template with `dependencies`.
- **Already in** the dossier's "extraction corrupts what it copies" (root cause 5). **New:** the edge copy and the code-side id.
- **Prior art:** the five-layer config:{} saga ended at "copy verbatim". This applies the same rule to edges, and adds the refusal that saga lacked.

**C4. The shape-signature borrow cannot lend a pathway whose endpoint shapes were never produced.**
- **Seam:** primarily C1 item 7 (fix the input). Interim: `index.ts:13213` `floorIsTheProvenPathway` additionally requires `match_mode === "goal_hash"`, carried from `recommendReachingPath` `:6876`.
- **Gate:** deterministic on `match_mode`.
- **Builder:** (a).
- **Verification:**
  - must-fail: a goal whose only candidate is a floor path borrowed by shape → full walk, no shortcut;
  - positive: an exact `goal_hash` floor path still shortcuts.
- **Already in** the 09-05 and 09-16 re-key findings, not landed. **New:** the floor-specific loop (§4.3).

**C5. Receipts are not reach content on the walk path.**
- **Seam:** the walk's judge digest `poolDigest` (`index.ts:11036-11056`). Apply the existing `isBookkeepingOnly` (task #59, already applied at `:14387-14394` on the single-template path) at this sibling call site.
- **Gate:** that predicate.
- **Builder:** (a).
- **Verification:**
  - must-fail: a 128-char `{"producedBy","executionId"}` → HOLLOW;
  - positive: the 279,200-char `learned_topology_snapshot` → REACH.
- **Already in** the memory law "grep the sibling call sites". The instance is **new**.

**C6. Liveness detectors close on recovery.**
- **Seam:** joint-liveness (`70254535`) → §2.1 evaluator registration.
- **Gate:** the binding lag drops below threshold, plus a positive-control resolve.
- **Builder:** (b).
- **Verification:** `severed-joint-ribosome-extraction` closes once a 7/7 run has existed for 24h. Must-fail: it stays open when the point lookup returns `count:0`.
- **Already in** §2.1 and dossier §7.1.

**Not proposed:**
- a new extractor;
- a new "report" or "answer" shape (law 3/4; §6 uses `human_presentation`);
- template-grain first/last-mile binding. It has no failed predecessor of the same form, and C1/C3 are its preconditions, because a body with no edges cannot be re-bound.

---

## 9. Unverified, and the method behind the numbers

- **Where the 2→1 task collapse happens** (synthesis or write) is unverified (§3.3). The synthesized impulse is not persisted.
- **Who deleted `learned-universal-tool-fallback`, and when**, is unknown.
- **Origin split of the 41.** The table uses the template's `metadata.extracted_from` prefix as the origin of a learned row, and that field is overwritten on each UPSERT.
- **SQL queries:** `SELECT * … LIMIT 1` first to learn field names, then `GROUP BY` with no `ORDER BY`. Reach counts read the `reached` column (`option<bool>`), with null reported separately.
- **Journal counts:** `grep -a -c` on whole log lines in [J].
- **Process listings:** none were used.
