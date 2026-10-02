# Track E: the history. Every earlier attempt to make the floor and the shape/learning mechanism one thing

2026-10-01. Read-only. Nothing was edited, dispatched, restarted or committed to produce this file.

**The question this answers:** "What happened last time we did this?" Here "this" is making the agentic floor (goal-host `universalToolFallback` / `runGroundedToolLoop`) feed the shape mechanism: traced steps, pool impulses, credit, extraction, reuse.

**What this builds on.** It does not restate them; it cites them:
- `dossiers/goal-walk-floor.md`: §2 timeline, §6 prior attempts at a unified producer view.
- `dossiers/composition-crystallization.md`: §1 timeline, §5 prior attempts at an extraction contract.
- `output-shapes/APPROACH.md` and its five track files.
- REALIGNMENT (origin/dev, with §9): §1, §2.0, §2.0b, §6.2, §7 step 8.

This file adds three things those records do not carry:
- the floor-specific attempt chain from the submodule git logs;
- the grounding-gate oscillation;
- the live measurement of what the floor actually feeds into the learning loop today.

**Sources and windows.**
- Git: `origin/dev` of goal-host-vessel (HEAD `76bb373`, identical to the live `/vessels/goal-host-vessel/src`), development-vessel, llm-resolver-vessel, activity-api, ribosome-vessel and the super-repo.
- Journals:
  - node 1 (`substrate-live`): the goal-host journal begins **2026-09-26 11:22Z**;
  - node 2 (`compose2-live`): the goal-host journal begins **2026-09-26 09:57Z**;
  - both windows run to about 2026-10-01 12Z.
- Gap store: `/workspace/git/super-repo/gaps/gaps.json` on node 1, filtered by id and summary.
- Operator memory files are cited as a **derived cache** (law 10), never as records. Each claim taken from one is marked "(memory)", and where a commit exists the commit is the source.

**P0 caveat.** CANON's warning ("restatement number eight") applies to this file too. Its §4 is written as acceptance criteria measured at the consumer precisely so that it cannot be satisfied by prose.

---

## 0. Answer in one paragraph

The floor has been **made to work as an answerer** many times. It has **never been made to feed the shape mechanism**, and every attempt that tried stopped at the same structural fact.

The agentic wrapper has owned default tool execution since 07-10: development-vessel `llm_completion_dispatch` passes the tools to llm-resolver, which executes them. By 07-27 at the latest, the wrapper surfaced no tool_calls to goal-host. On 07-23, `43247db` had observed the opposite (pending tool_calls with no text); git does not reconcile the two observations, and the 09-30 gap ties the behaviour to `tool_dispatch_endpoint` being absent. Every goal-host instrument and gate reads only the **client-side** loop, and that loop has executed no tool on either node in the retained window:
- `groundedOk`;
- the `tools=` counter;
- the persisted `tasks`;
- `commandEvidence`;
- the fabricated-transcript check;
- `isGroundedHonestReach`.

So the floor's reaches are, by construction:
- **ungrounded** to the mint gate;
- **edge-less** to the composition graph;
- **shape-less** to the ribosome;
- **a single opaque node** (`["universal-tool-fallback"]`) to the pathway store.

The one thing the floor teaches the system is "call the floor again".

Measured in the retained windows:

| node | floor verdicts | reached | client-side tool or grounded read | reach→mint invocations for a floor id |
|---|---|---|---|---|
| node 1 | 438 | 110 | 0 | 0 (of 118 reach→mint lines) |
| node 2 | 470 | 132 | 0 | 0 (of 47 reach→mint lines) |

Each earlier fix repaired one link of this chain. Each fix gated or measured on the client loop or the opaque node, so the next link failed silently. The seven declared "floor fixed" moments all measured whether the floor *answered*, never whether its answer became structure.

---

## 1. Timeline of attempts

Columns: date · intent · change · measured effect · retracted or reverted? · stated or evident reason. Hashes are goal-host unless stated otherwise. Rows that the two dossiers already carry are one line, with a pointer.

### 1a. The seven declared "floor fixed" moments (REALIGNMENT §2.0b, §6.2)

| # | date | claim | what it measured | later | source |
|---|---|---|---|---|---|
| 1 | 05-02..03 | "ReAct parity, 9/10 at ≤1.5× LLM calls" (minibob, `84200483`, `9022dd67`) | LLM-call parity on a benchmark | Outcome parity never measured. minibob was removed 05-24, and **no standing floor-parity instrument has existed since** | goal-walk-floor dossier §2 row 05-02..03 |
| 2 | 06-25 / 06-30 | "NL goals REACH end-to-end" (Lever 4 inference `f85a6d5`) | a reach on hand-picked goals | 07-02 misroutes; 09-29 "memory" maps to no shape; the B5 seeding criterion was never measured | dossier row 06-25 |
| 3 | 07-30 | deterministic templating 7 → 14/14 | hand-templated families only | two-op reach honestly 1/8; generality round 09-19 R 3/7 | dossier row 07-30 |
| 4 | 09-11 | "Ladder reached 7/7" | self-health, not reach | the same day: 8.6%/24h | dossier row 09-11 |
| 5 | 09-12 | "five substrate-authored repairs, reach 22.6%" | an operator-contaminated baseline | 09-13: autonomous 0.9–2.6%, operator 80% | dossier row 09-12 |
| 6 | 09-16 | "76 resolvers ~91% wired: ReAct floor met" | resolver wiring, a structural count | 09-18 floor dark on spokes; 09-22 resolve-URL joiner killed llm_completion, web_search and shellResult | dossier row 09-16 |
| 7 | 09-25 | "best bucket 51%" | non-comparable reach definitions | `8c31cdb` broke routing 12:09–12:36; retracted | dossier row 09-25 |

**Common property.** No claim tested whether a floor reach produced reusable structure. Each measured the answer side, and five of the seven measured the wrong population or the wrong variable. Not one was a standing measurement. All were operator-run snapshots.

### 1b. Where the tool loop lives (client vs wrapper): the root of everything below

| date | intent | change | measured effect | reverted? | reason |
|---|---|---|---|---|---|
| 07-10 | give the LLM step real tools | dev-vessel `ff3d5d58`: `DEFAULT_LLM_TOOLS` "**floor** tool names" reconciled to advertised shapes (source_code, fs_read, codeSearchResult, shellResult). Paired with llm-resolver `1333e3f`: "dispatchTool routes each tool call to its owning vessel via discovery". That commit is cited in ff3d5d58's message; `-S` did not find it in llm-resolver's post-split history | the wrapper becomes an **agentic loop that executes tools itself**. This is a second "floor", 13 days older than goal-host's | no, live today | the commit message calls it "the floor"; the two loops share one name from here on |
| 07-14 | cut cost | dev-vessel `8f8cd175`: an explicit `tools:[]` opts out of `DEFAULT_LLM_TOOLS`; an absent field "keeps the investigation defaults (… forced tool-loop path)" | any caller that omits `tools` gets the wrapper loop | no | — |
| 07-22 | spoke LLM answers were discarded | dev-vessel `da08516c` unwraps the federated `{content:{value}}` envelope | the floor's LLM tier stops 500ing on spokes | no | (memory) the floor had been "blocked by ONE federated-envelope parse gap" |
| 07-23 | a real ReAct loop in goal-host | **`43247db`** "Fix C": client-side tool→observe loop, 4 iters × 8 calls; **grounding gate: reach only when `groundedOk>0`** | floor 0/3 → 2/3 grounded, **but via `satisfier:shellResult`. The loop itself fired 0×** (memory, 07-23: "Fix C ReAct loop STILL 0× exercised") | relaxed 4 days later | the wrapper returned tool_calls with no text, so the client path was null |
| 07-23 | ground the a.5 investigation the same way | `6cba611` extracts `runGroundedToolLoop`, shared by a.5 and the floor; adds `commandEvidence` | fabrication `.rs=6` closed; **the shared loop was again 0× exercised** | no | — |
| 07-27 | "revive the dead ReAct parity floor" | **`559a55d`**: removes the `LLM_VESSEL_ENDPOINT` env gate; **drops the `groundedOk===0 ⇒ null` gate** because the wrapper "runs its OWN tool loop internally and returns a grounded final answer with NO client-side tool_calls" | prose-over-file goals reach "(0 grounded read(s), 0/0 tool(s))" | **re-tightened 07-31 by the substrate, relaxed 08-02 by the substrate** (§1c) | the decision that put the loop in the wrapper, made to fix the accounting rather than to move the loop |
| 08-04 | audit | (memory, 15-agent R1–R5 audit) "the floor never loops"; the client branch "has not executed once in 72h"; federation-transport `:272` spreads only `body`, so **`tool_calls`, `usage`, `model` are destroyed at the wire**; tools execute on the **hub** relative to the arm | grounded and confabulated answers are indistinguishable | no structural change followed | the evidence the floor needed was deleted below goal-host |
| 09-30 | make the wrapper's tool calls attributable and bounded | llm-resolver `fa9ca77` (the execution_id wins on a tool call), `2281b38` (per-dispatch input budget, bounded tool results), `cadf494` (dispatcher owns the tool type); goal-host `7d38196` (model args cannot retype the tool) | the 09-30 floor spend incident: 1.58M input tokens per call, gap `goal-host-floor-tool-loop-input-is-unbounded-…` | no | 7d38196 notes a "floor web-search change … **held for a containment decision**" (in flight, not an attempt) |
| 09-30 | name the root | gap `floor-tools-counter-reads-zero-because-llm-resolver-runs-the-tool-loop-and-dev-vessel-drops-its-tool-calls` (**open**): dev-vessel `llm-completion-dispatch.ts ~431-466` looks for tool calls inside `content`, finds a string, and returns `llmTextCompletion`; "0 of 81 floor verdict lines since 09-29 had groundedOk>0" | — | open | its CAUTION: llm-resolver's `tool_calls` are records of calls it already executed, so passing them up as pending calls would execute every tool twice |

### 1c. The grounding gate flipped four times on one line, twice by autonomous commits

```
07-23 43247db  DevBob        reach requires groundedOk > 0
07-27 559a55d  DevBob        (groundedOk > 0 || finalText)      — the wrapper grounds internally
07-31 f195496  Substrate Autonomous (route-edit-531e92e8)   groundedOk > 0 && finalText   — re-tightened
08-02 f4f983a  Substrate Autonomous (route-edit-2dc66950)   (groundedOk > 0 || finalText) — relaxed again
```

Each flip was locally correct:
- tightened, the gate refuses the wrapper's genuine answers (the floor goes dead);
- relaxed, it accepts confabulations. The 08-15 Io / eBay / Earth–Mars fabrications led to `23276d5`'s fabricated-transcript refusal and to the "GROUNDING: ZERO tools" banner in the judged digest (index.ts ~5482).

No position of this gate is right. **The evidence the gate needs is in the other loop.** The four flips are the cleanest single artefact of the "floor treated as a separate engine" regression class (§2 R1).

### 1d. Floor trace persistence and floor → pathway (the learning edge)

| date | intent | change | measured effect | reverted? | reason it did not make the floor feed the mechanism |
|---|---|---|---|---|---|
| 08-02 | make satisfier and floor picks gradable | (memory) 78% of feedback POSTs 404 on synthetic `satisfier:*` ids; lazy admission proposed | "the ReAct floor can never become a learned pathway" (memory, 08-02 §2) | — | the floor had no activity row and no trace |
| 08-05 | stop silent loop death | `ecd0c5a`: a timeout becomes an observation; `walkBudget` shape | 41/74 floor invocations (55.4%) had 0 act-observe cycles | no | it observes the **client** loop, which the wrapper path bypasses |
| 08-05 | carry the answer | `c43f59d`: answerBody was null on 100/100 floor dispatches; now returned | the answer reaches the surface | no | an answer, not structure |
| 08-06 | **persist the floor's execution** | **`8ee6c66`**: before this, the floor returned a fabricated id `universal-tool-fallback:<goalHash>`; "a 2,000-row window … contains ZERO floor executions". Now `persistSatisfierTrace` with "the tool calls as tasks and the reach verdict as a tag" | floor rows exist (verified 08-28: `universal-tool-fallback-20a4e662-…` resolves, reached:true) | no | tasks come from `executed`, the **client** loop. Through the wrapper they are `[]`. Hard-coded `compositionChain: []`, `inputImpulseIds: []`, `outputImpulseIds: []`, `outputShapes: []` (live index.ts 5535–5560) |
| 08-06 | **floor reach → learned pathway** | **`c033664`**: "`return uf` sits above every recordGoalPath call site … the floor wrote 0 of 4,768 goal-path rows" | rows written with `activities: ["universal-tool-fallback"]` | no | the pathway is **one opaque node**. "Learned" means "run the floor again" |
| 08-06 | make the recommendation actionable | `2d980fe`: when the recommended pathway is exactly the floor, run it directly (REUSE-BEFORE-DERIVE) | 110 `REUSE-BEFORE-DERIVE` lines on node 1 in the window | no | it reinforces the opaque node; see the 09-30 row below |
| 08-06 | regression of the above | `56ce793`: the floor shortcut "reached and wrote nothing" (the artifact bridge was skipped); now limited to non-artifact goals | — | partial | the shortcut skips the walk's terminal-output bridge: the floor is not a walk step |
| 08-08 | honest floor vs ceiling | (memory, 08-08) the floor recorded only its wins (172/172 by construction). Gaps filed: `floor-records-only-its-wins` (site 1 fixed autonomously, `550ce23`), `walk-tier-is-a-name-substring-not-reuse`, **`minted-copy-of-the-floor-shadows-the-floor`**: the ribosome minted `learned-universal-tool-fallback`, **3/32 (9.4%)** vs the real floor; `normActivityId` mismatch, so it was never substituted | honest floor 23.9% (205/859, 7d to 08-08) | the copy row is gone by 09-29 (`mechanisms/chunk-27.md`) | **the only time a floor reach was ever extracted, it became a single-node copy of the floor**. Law 3 and law 4 failed in one artifact. The id is **not** in the live gap store today; the positive control is that the same filter returned about 50 other floor gaps |
| 08-09 | make a floor reach gradable and auditable | **`8928e59`**: tags `completion_shapes:<targets>` on a reach; persists `final_text` (cap 4000) and `target_shapes` | the reach row carries its **requested** shapes | no | completion_shapes are the **targets the goal asked for**, not shapes the floor produced. No impulse was added to the pool, so there is nothing to bind or extract |
| 08-21 | thread walk evidence into grading | `validation/reports/COMPOSITION_LEARNING_ARCHITECTURE_2026-08-21.md:112`: "`:4591` (floor) — **DO NOT TOUCH.** No `opts`, so no `stepSink`/`learningSink` in scope; … inert by construction" | — | — | the floor is a separate function with no learning sinks. **Live signature unchanged**: `universalToolFallback(goal, targetShapes, dispatchId)` (index.ts:5295) |
| 08-16 (report commit `6ac76284`) | lessons into the floor | `validation/reports/LEARNING_ARCHITECTURE_REVIEW.md:189`: "The ReAct floor is outside every law-8 channel … no lessons parameter" | — | never changed | live: no lessons, no `priorVerdictFeedback`, no concept recall in the floor (only `recipeSeed`, `investigationSeed`, `multiQuantityNote`) |
| 08-27 | index floor reaches by shape | `6d96a81`: `completion_shapes: []` from deterministic oracles fell through `??`, so "`recordGoalPath (floor reach) shapes=[]`"; 0 REUSE LINEAGE events | — | no | indexed by the **requested** shapes again |
| 08-28 | reuse a floor pathway on a paraphrase (rung b) | (memory, 08-28) both the floor pathway (3/3) and a `satisfier:shellResult` composition (4/4) were retrievable, and the floor was outranked by raw count. Gap `pathway-reuse-ranks-by-raw-success-count-starves-verified-floor`; Wilson ranking `785293c` | — | — | even when the floor reached and was retrievable, what is reused is the node, not a chain |
| 09-03 | attribute failed floor reuse | `43977e5`: "of 9,396 goal_execution_paths rows only 4 carry reused_from_goal_hash … all 4 are reaches" | lineage on failure | no | — |
| 09-22 | failure side | `9e23455` (operator bypass): failure memory keyed by goal_hash, fed to the **walk's** attempt 1 via `priorVerdictFeedback`; `64ce0ac` feedback edge (re-run the same chain with the judge's reason) | — | no | **the floor reads neither** (signature above). A floor failure is not located at a step: there are no steps |
| 09-24..26 | carry the execution id on floor tool calls | gaps `route-edit-7d36b57e`, `route-edit-d53b7f58` (closed); super-repo `2a4a907e` "goal-host 959519e — floor carries the dispatch id"; gap `the-universal-executor-drops-execution-id-when-async-local-dispatch-context-is-empty` (**open**) | client calls carry it; wrapper calls did not until llm-resolver `fa9ca77` (09-30) | — | the 09-30 gap: wrapper tool calls reached local-tools with **no execution_id** and "never enter the pool or trace" |
| 09-30 | (consequence) | gap `judge-accepts-a-plan-as-the-work-and-reuse-before-derive-reinforces-it` (**open**): the floor ran tools=0/0, reached on a plan ("Would you like me to proceed…"), and the reach raised the REUSE-BEFORE-DERIVE tally (5/7). Its recompose failed `semantic_reject` | — | open | the opaque-node pathway compounds false reaches: `recommendReachingPath` counts success/total with no grounding term |

### 1e. Ribosome extraction from floor reaches

| date | event | effect |
|---|---|---|
| 07-21 / 07-23 | `isHonestlyReached` `8d969b4`; **mint only grounded reaches `411417b`** | live today as `isGroundedHonestReach` (index.ts:6207). It requires `deterministic` or `consumedInChain>0`; the commandEvidence arm was removed on measurement (72/80 reached vs 23/80 correct). **A floor row satisfies neither condition**: the wrapper gives no command, and the chain is empty |
| 07-23 → 07-27 | 411417b ("mint only grounded") + 559a55d ("trust the ungrounded-looking wrapper") | these two are jointly satisfiable **only by never minting from the floor**. Neither commit names the other |
| 08-08 | the ribosome WS path (not reach→mint) minted `learned-universal-tool-fallback` | 3/32; later gone (§1d) |
| live | `mintReachedTrace` has 3 call sites (index.ts 11723, 11778, 14416): the walk, the composite and the selected-template dispatch path (`result.trace`, `selId`). The floor's returns at 13250, 13532 and 13547 reach none of them with a trace | node 1 window: 118 reach→mint log lines, of which 94 `ran ribosome-extract` and 24 `SKIP ungrounded … bare-LLM-yes / no executed-tool anchor`, and **0 name a `universal-tool-fallback` id**. Node 2: 47 lines, 0 floor. The positive control is that the same grep pattern returned the 118 and 47 lines |
| 09-22 → now | all extraction is hollow anyway: `v_paradigm_execution_traces` became a plain table; no `learned-*` since 09-22 07:39Z | composition-crystallization dossier §1, §4. **So even a correct floor→mint wiring would be inert today**, which is a precondition, not a detail |
| live | edges are derived only from `parent_execution_id` at ingest (activity-api `516fc73`) | floor tool calls are not child executions, so **0 edges** from any floor run |
| live | detectors read the floor row as a broken template | open gaps: `phantom-success-universal-tool-fallback-…` (task_count=0), `systematic-failure-universal-tool-fallback-zero` ("(no tasks)"), `precondition-rejection-universal-tool-fallback-2026-09-18/-09-30`, `wasted-cycle-universal_tool_fallback`, `novel-failure-universal-tool-fallback\|execution_error-…`, `detector-coverage-gap-execution_error_universal_tool_fallback`. **The row that exists to be graded generates gaps against itself** |

### 1f. Recipe seeding (`recipeCommandFor`)

| date | change | effect | status |
|---|---|---|---|
| 08-07 | `48f67f9` verifier recipes as data; `30cbd14` let a recipe ANSWER in the walk's cascade | the recipe-as-answerer fired **0×** in 48 goals: "the classes that fail … land in the FLOOR" | live |
| 08-07 16:10 | **`1021176`** seed the floor with the family recipe as an OBSERVATION | worst run of the series, 17/48, while firing 12× | **reverted 16:29 `d73da0b`** |
| 08-07 17:42 | **`c671407`** restore, on the theory that "selection never left the bad arm"; tested jointly with β (`62a00f54`) | no recorded result for the joint hypothesis was found in git | live code (index.ts 5327–5347) |
| 09-22..29 | — | `recipeSeed` has 0 journal hits in 7 days (dossier §7). Node 1 window: only `[verifier-recipe] loaded 4 family recipe(s)` at boot | **held in code, never exercised**. The recipe is injected as prompt text into a loop whose tools run elsewhere, and a recipe-seeded reach is still not minted |

### 1g. Prompt text as the landed fix

- 08-15: `f73faaa`..`3496df5`, about 30 prompt commits for one live-data goal. `2c26fcb`: "stating it in the prompt does not hold" (dossier row 08-15..17).
- 08-15: the "GROUNDING: ZERO tools" banner. The judge still reached a fabrication (gap `judge-accepts-a-plan…`, PRIOR ART section).
- 09-19: `7f20608` (Substrate Autonomous) closed `gap-floor-generates-exact-values-instead-of-executing-the-procedure` with **`falsifier: "unresolvable"`**. The change is the "EXACT COMPUTATIONS … MUST be produced by EXECUTING" paragraph now in the floor prompt (index.ts:5398). The narrowed child is **open**, after 3 failed recomposes (`no_unique_anchor`, two `verify_failed` TS2353).
- **Why prompt text keeps being the shape of the fix:** the tools run in the wrapper, so goal-host's only channel into the loop is the prompt. Evidence-supplying fixes held (f44b27b's commandEvidence; 5e4d045's citation oracle); instruction fixes did not. This repeats K-law "information at the right time": the information has to be **structural** (a record), not imperative (a sentence).

### 1h. Partial successes that did hold (so they are not re-proposed)

- `825f773`: 5xx becomes an observation.
- `c43f59d`: the answer is carried.
- `8ee6c66`: the row exists.
- `c033664`: the path row exists.
- `2504fb0`: the judge grades the answer, not the scratchpad.
- `23276d5`: a fabricated transcript is refused.
- 08-27 investigation floor (`752014d`…`5e4d045`): grep seeding plus a deterministic citation oracle, verified reached (memory 08-27, dispatch `ab7074b1`). SEEDED lines still fire on node 1: 93 in the window.
- 07-26 cold-floor self-correction `c7870bd`: 2/4 → 4/4, held-out, operator-run.

All of these improve the floor **as an answerer**. None adds an edge, an impulse or a template.

---

## 2. Governing reasons the attempts regressed

**R1. The floor is a separate engine, outside the walk's learning sinks.**
- `universalToolFallback(goal, targetShapes, dispatchId)` takes no `opts`: no `stepSink`, `learningSink`, lessons, failure memory or pool.
- It was declared "DO NOT TOUCH … inert by construction" (`COMPOSITION_LEARNING_ARCHITECTURE_2026-08-21.md:112`). It is unchanged at live HEAD.
- Every attempt to make it learn bolted a record on **after** it returned: `8ee6c66` trace, `c033664` path, `8928e59` shapes, `2d980fe` reuse. So what is learned is the engine's name, not its steps.
- Evidence: the `["universal-tool-fallback"]` pathway; the `learned-universal-tool-fallback` copy (3/32); REUSE-BEFORE-DERIVE compounding a plan-reach (09-30 gap).

**R2. The loop that does the work sits two hops below the instruments that judge it.**
- From 07-10 (`ff3d5d58` "floor tool names") the wrapper has owned default tool execution. By 07-27 it surfaced no tool_calls to goal-host; the 07-23 observation of pending calls is unreconciled.
- `559a55d` accepted this rather than moving the loop. Then:
  - the transport stripped `tool_calls` (08-04);
  - dev-vessel drops them (09-30 gap);
  - tool calls reach local-tools with no execution_id (09-30 gap).
- Measured, both journal windows: node 1 438/438 and node 2 470/470 persisted floor rows read `tools=0/0`; `groundedOk>0` is 0/438 and 0/470.
- So every gate keyed on client evidence (`groundedOk`, `executed`, `commandEvidence`, `isGroundedHonestReach`) is either dead or wide open. Which one depends on how it treats zero: §1c.

**R3. Fixed on one path, not the sibling.**
- The grounding gate flipped four times on one line (§1c).
- `ecd0c5a` (timeout as observation) left the adjacent `!r.ok` break, closed 12 days later by `825f773`. Its commit says "the timeout comment's own reasoning is what licensed leaving this half broken" (memory 08-17).
- `411417b` (mint grounded only) and `559a55d` (accept ungrounded-looking) were landed four days apart without reference to each other.
- The recipe was wired into the walk's cascade (`30cbd14`), where the failing classes never arrive, then into the floor (`1021176`).

**R4. Measured by a counter that could not see the thing.**
- `tools=0/0` counts client calls only (REALIGNMENT §1, R1-15).
- `success_count` is a first-run flag (`goal-paths.ts:680`).
- Floor rows were 172/172 by construction (08-08).
- `walk_tier` was a name substring.
- `ribosome-extract` reported `status:success` with tasks 2–7 skipped (1,437/1,440, 7d to 09-29).
- All seven "fixed" claims (§1a) measured answers, not structure. Not one was a standing activity.
- Since 05-24 there has been no floor-parity instrument, and the 09-19 baseline arm never ran.

**R5. Prompt text instead of evidence.** See §1g. A fix that must act through a loop it cannot see can only speak to it, and "stating it in the prompt does not hold".

**R6. Credit and extraction were never wired from the floor. Now they cannot be, because the extractor is dead upstream.**
- 0 floor ids in reach→mint on either node.
- `mintReachedTrace` is not called from the floor.
- The mint gate's conditions are unsatisfiable on the floor's row.
- Separately, no `learned-*` has been minted by anyone since 09-22 07:39Z (crystallization dossier §1, §4).
- A floor→extraction seam built today would therefore inherit a hollow extractor. This is the crystallization class's "address that other work keeps moving".

**R7. Correct-looking rows that mean the opposite.** The floor row records:
- `completion_shapes` = the **requested** targets (`8928e59`);
- tasks from the empty client list;
- `compositionChain: []`;
- hard-coded `costUsd: 0` and `durationMs: 0` (index.ts 5548–5549).

Empty tasks plus zero duration is exactly the signature of an engine pre-flight rejection. That is why `phantom-success-…` and `precondition-rejection-…` ("duration 0-0ms, tasks_completed=0") fire on it: detectors read it as a template with no tasks and file gaps against it (§1e). To humans it reads as "reached, shapes X".

---

## 3. What the architecture docs specify, and where the code diverges

**Where the floor/ReAct relationship is stated at all.**
- `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`, `SUBSTRATE_AS_SOFTWARE.md` and `SUBSTRATE_AS_DYNAMICS.md` contain **no** "floor", "ReAct" or "tool-enabled fallback" (`git grep` on origin/dev).
- The statement "the walk with tool-enabled fallback *is* the ReAct loop … every step lands in a trace" exists in mechanism-adjacent form in only three places:
  - `CLAUDE.md:47-51` (the contract);
  - `IMPULSE_STATE_SPACE_SPEC.md:194` ("the tool-enabled universal fallback runs as the ReAct floor");
  - `sequences/04-improvisation-failure-modes.md` (:22, :125, :208–251).
- **Nowhere is it specified in mechanism terms**: what a floor step's impulse is, what shape it carries, how it binds into the pool, or how it becomes a task with input and output shapes.

**What the foundation docs specify for "improvisation", which the floor now occupies** (`04-…md`: "what older designs called improvisation is covered by … the floor"):
- IAF §Learn (:546-551): "Improvisation succeeded: **extract as new activity template**".
- IAF §Ribosome (:685-695): "identify the **input impulse shapes** … extract the **step sequence as activity tasks** … register for future matching".
- IAF :1039 and SOFTWARE §3.2: "the **reached** trace is what the ribosome mints".
- SOFTWARE §3 step 5: trajectory = a **1-chain** along `composition_chain`. Step 8d: composition-edge write.
- IAF :543-544: an absent chain "means 'not recorded', never 'this execution is a root'".

**Divergences (doc vs code, live HEAD `76bb373`):**

| doc says | code does | evidence |
|---|---|---|
| floor "every step of the attempt lands in a trace" (`04-…:125`) | wrapper tool calls are not in the pool or trace; client tasks are empty | 438/438 and 470/470 `tools=0/0`; 09-30 gap ("never enter the pool or trace") |
| sequence diagram: `LLM-->>Loop: text and/or tool_calls`, `groundedOk++` per call (`04-…:208-251`) | the wrapper returns text only; `groundedOk` 0/908 across both nodes | the 09-30 gap; journals |
| a reached trace is minted (IAF :1039, SOFTWARE §3.2) | the floor path never calls `mintReachedTrace`; the mint gate refuses floor rows | 0/110 (node 1) and 0/132 (node 2) floor reaches with a reach→mint line |
| extract input impulse shapes plus a step sequence (IAF :685-695) | floor row: `inputImpulseIds: []`, `outputImpulseIds: []`, task `outputShapes: []` | index.ts 5535–5560 |
| trajectory is a 1-chain along `composition_chain` (SOFTWARE §3 step 5) | `compositionChain: []` hard-coded on the floor | index.ts 5535 |
| goal-path = attribution (SOFTWARE 8e) | the floor path is the single node `["universal-tool-fallback"]` | index.ts 13250, 13532, 13547 |
| `completion_shapes` = shapes that "would actually satisfy" the goal, emitted by the judge (IAF :1038) | the floor tags the **requested** targets as completion shapes | index.ts:5565; `8928e59` |
| the floor "over the tools discovery can reach" (`04-…:125`) | a fixed `UNIVERSAL_READ_TOOLS` plus the goal's write shapes | index.ts 4565, 5391 |

**Code that matches the docs.**
- The floor is bounded (4 iterations, deadline), as specified.
- It records a `universal_tool_fallback` walk tier (`GOAL_EXECUTION_PATHS_SCHEMA.md:55`).
- Its reach is judged by the same `verifyGoalReached`.

The divergences are all on the **learning half**, which is the half this realignment asks for.

---

## 4. What must be different this time: preconditions and acceptance criteria (measured at the consumer)

This section states no seams and no builders; tracks A–D own those. Each criterion has these properties:
- it must hold on **node 1 and node 2**;
- it must be checked by a **standing activity on a rhythm**, not an operator snapshot (R4);
- it carries a **positive control** through the same address and a **must-fail control**;
- every reported number names its window and denominator.

**P0. Preconditions. If any is false, every criterion below is "not evaluable", never "met".**
1. **Extraction is alive.** A known-reached, non-floor execution, pushed through `executionTraceWithSignatures` by id, returns non-empty `tasks`, and the extraction produces a `learned-*` row with `metadata.extracted_from` set. This is crystallization dossier §7.1–7.2. Today it fails: 0 mints since 09-22 07:39Z. Without this, R6 makes any floor wiring inert on arrival.
2. **Tool executions are visible to goal-host as records.** The R1-15 control must pass first: the goal-host line-count question the wrapper "answers correctly" (index.ts ~5476) shows `tools>0` and `groundedOk>0` on its floor verdict line. The must-fail control: a run whose tools were executed only inside a layer that returns no records is counted `tools=0`. If the counter cannot be moved, it is declared dead, and no later criterion may cite it (K4).
3. **§9.0 holds** for any shape the floor newly resolves or writes: locality plus route authentication. A floor that "acts by resolving shapes" over unauthenticated routes widens the injection surface.

**A1. A floor step is a traced shape resolution.**
- For a floor run, every tool call appears as a task row with a `resolverId` and **non-empty `outputShapes`**, plus an output impulse id that resolves in the pool.
- Over the window, the count of task rows equals the number of tool executions recorded by the executing layer: equality, not "> 0".
- Positive control: a walk step's row has these fields today.
- Must-fail control: a floor run answered from memory, with zero executions, persists zero task rows and is not reached on a live-value goal.

**A2. The persisted floor row is a chain, not a node.**
- `compositionChain` (or `parent_execution_id` on per-step child rows) is non-empty for a ≥2-step floor reach.
- `activity_composition_graph` gains ≥1 edge whose endpoints are floor-step producers within 1 tick of that reach.
- `completion_shapes` equal shapes **produced** (present in the pool), not the requested targets.
- Must-fail control: a reach whose answer impulse consumes none of the step impulses is refused as unconsumed.

**A3. A floor reach passes the same mint gate as any reach, and is minted with edges.**
- A `reach→mint` line names the floor execution id.
- The resulting `learned-*` template has taskCount ≥ 2, non-empty `input_shapes`, and ≥1 composition edge.
- Its id is **not** a copy of the floor: no task resolver equals `universal-tool-fallback` or `llm_completion_dispatch`-as-whole-loop. This is the `minted-copy-of-the-floor` must-fail control.
- Positive control, in two parts:
  - for the **invocation**: a walk-composite reach produces a `reach→mint` line today (94 of 118 on node 1 in the window);
  - for the **product**: no template row is produced today, by anyone (P0.1). Until P0.1 holds, A3 is "not evaluable". It is never read as "minting works, just not for the floor".

**A4. The ceiling consumes it.**
- Within the window, ≥1 template minted under A3 is **selected** for a goal whose `goal_hash` differs from its source, and it reaches. This is first/last-mile adaptation.
- The accept line names that template or a shape signature, **not** `["universal-tool-fallback"]` and not `via goal_hash`.
- Report it as the count of such reaches over the count of floor-minted templates, with the window.

**A5. The floor stops reinforcing itself as an opaque node.**
- A floor reach with no executed-step record leaves the REUSE-BEFORE-DERIVE tally for that pathway unchanged. Unit and live control: one tools=0 reach does not move it; one with executed steps does.
- `learned-universal-tool-fallback`-style rows: 0 created.
- The goal_hash 959fae18 replay does not reach on a plan or offer (from the 09-30 gap's falsifier).

**A6. Failures are located at a step and read back.**
- A not-reached floor run records the failing step (shape, producer, error) in failure memory.
- The next dispatch of the same goal_hash carries it in `priorVerdictFeedback` **into the floor**, not only into the walk.
- A route-around record ("producer X absent or failed, routed via Y") is emitted per §2.0b, and its counter is readable from node 2.
- Must-fail control: a transport-level failure (socket drop, 401) is not recorded as evidence about the world (gaps `a-walk-treated-a-401-as-an-observation…`, `goal-host-floor-treats-a-transient-socket-drop-as-terminal`).

**A7. Floor parity is measured, not declared.** This is the eighth "fixed" claim's gate.
- A standing need-phrased battery runs with deterministic oracles and a **ReAct baseline arm that runs first** (REALIGNMENT §7 step 8, R1-13).
- Its output is sandboxed away from the memory and gap stores.
- Report floor tier reach split need-phrased vs tick, from the reach verdict only.
- No "floor fixed" statement is valid unless A1–A6 hold in the same window. That is the distinction §1a never drew between *answering* and *feeding the mechanism*.

**A8. Durability (law 7).** For 14 days, none of these gap families reopens:
- `phantom-success-universal-tool-fallback-*`;
- `systematic-failure-universal-tool-fallback-*`;
- `wasted-cycle-universal_tool_fallback`;
- `floor-tools-counter-*`;
- `lost-reached-verdict-universal-tool-fallback-*`;
- the `minted-copy-of-the-floor` class.

Every pre-existing open member of these families must be closed by a re-measure under that family's own falsifier. A bulk close does not count (REALIGNMENT §6.2, three bulk closes).
