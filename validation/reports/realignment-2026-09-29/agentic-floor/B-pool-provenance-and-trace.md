# Agentic floor, track B: observations as pool impulses with provenance, and traces that carry the chain

Read-only investigation, 2026-10-01, about 15:40–16:25Z. Nothing was dispatched, written (except this file),
restarted or committed. No vessel route was POSTed. The only POSTs were SurrealDB `/sql` requests carrying SELECT/LET/INFO
statements.

**Sources**
- Live goal-host source `/vessels/goal-host-vessel/src/index.ts` in `substrate-live` (18,114 lines). It is
  byte-identical to `origin/dev` `76bb373` (as the output-shapes census recorded). Every `index.ts:N` below refers to that file.
- Live development-vessel `src/resolvers/llm-completion-dispatch.ts`, llm-resolver-vessel `src/index.ts`,
  activity-api `src/routes/execution-trace-with-signatures.ts` and ribosome-vessel `src/index.ts`, all in the container.
- SurrealDB `activity-system/learning_loop` on node 1, read with SELECT only. Tables: `execution` (the trace row),
  `execution_trace_content` (per-task structure), `goal_execution_paths`, `activity`, `impulse`.
- activity-api `GET /v2/activities/execution-traces/<id>` (GET only).
- goal-host journal. It begins **2026-09-26T11:22Z**, so every journal count below covers 09-26 11:22Z → 10-01 ~16:20Z.
- Gap store `/workspace/git/super-repo/gaps/gaps.json`, read through filters.
- REALIGNMENT from `origin/dev` (with §9). Cited, not redone: the output-shapes census
  `output-shapes/APPROACH.md` and track 2 `output-shapes/2-output-chaining.md`.

**Retention caveat.** The trace store is retention-swept (per-stratum caps plus a 150K global ceiling).
Every store count is "rows retained at query time", not lifetime. I stamp the window each time.

---

## 0. Corrections to the brief's premises

1. **The floor did run for `a30a893c` on 10-01.**
   - At 16:04:10Z, after two HOLLOW walks, the journal shows `floor: ENTER universalToolFallback goalHash=a30a893c targetShapes=["web_search","llm_completion","obsidian:write_note"]`.
   - The run was persisted as `universal-tool-fallback-a30a893c-1790870667193`, `reached=false tools=0/0`.
   - Its `final_text` says "I cannot retrieve the headlines due to invalid or missing API keys for the news services". That is evidence of tool use inside the wrapper, which the trace cannot show.
   - So the "never ran on 10-01" statement holds only for dispatches 5bef2e86 and cea3f4a4, not for the goal.
2. **"task_count 0" on floor traces is structural, not a retention effect.**
   - **0 of 1,824** retained floor `execution` rows have a row in `execution_trace_content`.
   - Positive controls through the same table and the same prefix query: **178/178** `walk-composite-*` rows and **6,947** `walk-satisfier-*` rows do.
   - `metadata.tools_total = 0` and `grounded_reads = 0` on **1,824/1,824** floor rows (09-10 13:54Z → 10-01 16:04Z).
   - In the journal, **0 of 439** `floor: persisted execution` lines read anything other than `tools=0/0`.
3. **Trace-level `input_impulses` is empty on all 150,032 `execution` rows**, not just on floor rows. Edges live
   only at task level (`execution_trace_content.tasks[].input_impulse_ids / input_shapes`). Do not read
   "floor rows have no input impulses" as a fact about the floor alone.
4. **Pool impulse ids are not durable identifiers.**
   - `walk-<shape>-<n>` comes from a per-walk counter (`index.ts:7543-7546`).
   - None of them is in the `impulse` table. I looked up `walk-code_modification_proposal-9` and `walk-code_read_lines-3`: 0 rows. Positive control: `impulse:impulse_*` rows exist.
   - Engine impulse ids such as `disc:problem_detection_k7k0a6ua` are not there either (0 rows).
   - The ids collide across walks. `walk-code_modification_proposal-9` is the output id of two different composites (09-29 00:27Z and 10-01 00:57Z).

---

## 1. Q1: the walk's pool. Real impulses, or in-process only?

**In-process only.** The pool is a closure-local array inside `runGoalAsPoolWalk`. Nothing is written to an
impulse store.

| Seam | What it does | Cite |
|---|---|---|
| `mkImpulse` | `{ id: "walk-<shape>-<++impulseSeq>", pointer:{type:"memo"}, metadata:{ shape, summary, producedBy: "goal-host-walk", goalSignature }, content }`. **`producedBy` is the constant `"goal-host-walk"`.** The real producer survives only as free text in `summary` ("produced by <pick.id>", "vessel-resolve satisfier (<shape>)"). | `index.ts:7543-7551` |
| `addToPool` | Appends a `poolEvents` entry `{shape, source: summary, at}` to the dispatch record, capped at 64. Then it is **first-wins per shape**: `if (producedShapes.has(shape)) return`. A second, better impulse of the same shape (a corrected retry, a second search) is dropped silently. It records no consumed ids. | `index.ts:7552-7562` |
| `poolVars` | Exposes each impulse's content as a `{{shape}}` variable for template binding. | `index.ts:7567-7578` |
| Template step | `host.runTemplate(template, poolVars(), { impulses: poolImpulses, … })` passes the **whole pool** as input. The output merge reads the engine's `outputImpulseIds` from the runtime ImpulseStore and **re-adds them under new `walk-*` ids** (`addToPool(shape, imp.content, "produced by <pick>")`). The engine id is lost at that point. Declared outputs that have no recoverable content enter as stubs `{producedBy, executionId}`. | `index.ts:10856-10911` |
| Satisfier step | `addToPool(satisfiableNow, resolved.content, "vessel-resolve satisfier (…)")`, then a synthetic `walk-satisfier-*` trace. | `index.ts:10141-10228` |
| `mirrorWalkState` → `poolProvenance` | Every iteration it writes `rec.poolProvenance = poolImpulses.map → {shape, goalSignature, producedBy, contentPreview(≤2000), chars, truncated}` onto the dispatch record. `goalWalkState` then serves it. **`producedBy` is always `"goal-host-walk"`.** | `index.ts:9808-9837`, body `:17250` |
| Lifetime | `pruneStore` blanks `poolProvenance` and `poolEvents` after the newest records. Each walk overwrites the previous walk's `poolProvenance` (open gap `goalwalkstate-discards-prior-walk-attempts-within-a-dispatch`). | `index.ts:17871-17880` |

**Provenance actually kept, per impulse:**
- shape;
- goalSignature (`ced125b`, 07-25);
- producer **as prose** in `summary` / `poolEvents.source`;
- a 2,000-char preview.

**Not kept:**
- a durable or unique id;
- the producing execution id. It exists only on stubs, and on satisfier synth traces through `outputImpulseIds`;
- the consumed impulse ids. These exist only on the synthetic satisfier trace, and only for llm_completion and terminal writes;
- content past the dispatch record's lifetime.

**Consequence for the ribosome.**
- `executionTraceWithSignatures` (`activity-api routes/execution-trace-with-signatures.ts:683`) joins impulse ids against the `impulse` table to recover pointer type and shape.
- No `walk-*` id is ever there, so every walk-origin trace falls back to shape-only signatures (`:779-807`).
- The file's own header (`:16-20`) says per-task impulse arrays "will be empty on all existing traces" and that the extractor uses same-execution co-occurrence instead.

**The floor has no pool at all.**
- `runGroundedToolLoop` keeps `observations: string[]`: `TOOL <name>(<args≤300>) =>\n<result≤4000>` (`index.ts:5267-5275`).
- They are fed back by string concatenation into `iterPrompt`, capped at 12,000 chars (`:5193`).
- The tools are shapes, resolved through discovery by `ufExecuteTool` → `ufResolveUrl` (`:4688`, `:4572`). That is a second resolution path, beside the walk's `endpointForShape` + `rawResolve`.
- In the retained window **no tool call reached that code**. The tool loop ran inside llm-resolver (§2.3).

---

## 2. Q2: trace persistence, and what the store holds

### 2.1 The writers

| Writer | What it persists | Cite |
|---|---|---|
| `persistSatisfierTrace` | Wraps the engine's own `TranslatingTraceSink` (same schema mapping) and adds dispatch spend. It is used by satisfier steps, the failed-walk trace, the durable reached satisfier trace and the floor. | `index.ts:6684-6700` |
| Satisfier synth trace | `walk-satisfier-<n>-<ts>`, `templateId:"satisfier:<shape>"`, one task with `outputShapes:[shape]` and `outputImpulseIds:[walk-<shape>-k]`. **`inputImpulseIds`/`inputShapes` are set only for llm_completion and terminal writes**, to *every* non-terminal shape in `chainProduced` (see Q5). There is no reach tag (a "satellite"). | `index.ts:10151-10227` |
| `buildCompositeTraceFromChain` | Called only on a walk reach with chain ≥ 2 and a satisfier last step (`:11748`). One task per chain entry. **Edges are positional**: step i's `inputShapes = [shapeOf(chain[i-1])]` and `inputImpulseIds = [poolId(prev)]` (`:7012-7016`), whatever was actually bound. `shapeOf(id)` strips `satisfier:` but returns a **template id unchanged**, so a template step's "input shape" is `activity:⟨…⟩`. Tagged `reached:true` when grounded or when ≥ 2 tasks produced pool impulses (`:11749-11750`). | `index.ts:6981-7052`, `:11748-11777` |
| `recordGoalPath` | POSTs `/v2/goal-paths` with `path_activities`, `endpoint_output_shapes` (the walk sends `chainProduced`), `expected_output_shapes` (target), `walk_tier`, `tools_used` (walk only: `effectLedger`). | `index.ts:6573-6668`; walk calls `:11894`, `:11929` |
| Floor trace | `universal-tool-fallback-<hash>-<ts>`: `compositionChain:[]`, `inputImpulseIds:[]`, `outputImpulseIds:[]`, `tasks = executed.map(…)` with `outputShapes:[]`. Tags `completion_shapes:<targetShapes>` (the **requested** targets, only on reach). Metadata holds `final_text` capped at 4,000. | `index.ts:5527-5594` |
| Floor path rows | `recordGoalPath(goal, ["universal-tool-fallback"], …, "universal_tool_fallback", uf.completionShapes, seededOutputShapes)`. The path is one opaque node. **No `toolsUsed` argument.** `uf.completionShapes` = the judge's `completion_shapes`, else `produced` = targets ∪ called write shapes (`:5428`, `:5615`). | `index.ts:13229`, `:13250`, `:13532`, `:13547` |

### 2.2 The store, measured (node 1, queries 16:05–16:21Z 10-01)

| # | Measure | Count / denominator | Window and address |
|---|---|---|---|
| S1 | Floor trace rows | **1,824**: reached **304** (16.7%), not reached 1,520 | `execution` where `activity_id="universal-tool-fallback"`, executed 09-10 13:54Z → 10-01 16:04Z (retention-bound) |
| S2 | Floor rows with any task structure | **0 / 1,824**. Controls: composites 178/178, satisfiers 6,947 | `execution_trace_content` by execution_id prefix |
| S3 | Floor rows with tools_total > 0 or grounded_reads > 0 | **0 / 1,824** | `execution.metadata` |
| S4 | Floor rows tagged `reached:true` but with column `reached=false` (status success) | **13** | Unattributed. Candidate: a later `/reach` or human grade flipped the column while the tag stayed. This is root cause 1 of the composition-crystallization dossier (tag vs column) appearing live. |
| S5 | Floor reach rows carrying `completion_shapes:` | 314 tagged (304 + the 13 above, less 3 with empty `target_shapes`). By construction (`:5575`) the tag = requested targets. | `execution.tags` |
| S6 | Floor path rows in `goal_execution_paths` | **1,778** rows with `path_activities=["universal-tool-fallback"]`, 12,444 executions, 1,298 "successful" (the counter family §1 rules indicative-only). 673 rows have successful > 0, 578 of which have non-empty `endpoint_output_shapes`. **550 of those 578 have `endpoint_output_shapes = expected_output_shapes`**: the floor's "produced" shapes are its requested shapes. | `goal_execution_paths`, lifetime |
| S7 | `typical_tools_used` non-empty | **0 / 1,778** floor rows. **Positive control:** 7,683 rows in walk tiers (fresh 2,504, satisfier 3,908, learned 1,266, feature_compose 5). | `goal_execution_paths` |
| S8 | Floor in the journal | 501 `floor: ENTER`, 439 persisted, 0 with tools ≠ 0/0, 66 `recordGoalPath (floor reach)` (0 with `shapes=[]`, so `6d96a81` held) | journal, 09-26 11:22Z → |
| S9 | Walk composites | **178** retained (09-25 → 10-01). 124 are `shellresult-to-memorynote-write`. 80 `composite recorded` lines in the journal window. | `execution` and `execution_trace_content` |
| S10 | Composites whose edges name a **template id** as an input shape, with a step that has no output shape | **9 / 178** (the mixed template+satisfier chains). The other 169 are satisfier-only. | `execution_trace_content.tasks[].input_shapes` |
| S11 | `learned-*` minted since 09-22 | Resumed on 09-30: for example `learned-composition-federation-verification-report-to-shellresult` at 17:04:49Z, minted 11 s after composite `walk-composite-federation-verification-report-to-shellresult-euaxjq`. 151 `learned-composition-*` rows exist in total. | `activity` |

### 2.3 Positive control (walk) against the floor, row by row

**Walk composite** `walk-composite-code-read-lines-to-activity-compose-auto-bridge-problem-detectio-z66rum`
(09-29 00:27Z, `reached:true`, `content_source:"split"`):
- `composition_chain = [walk-satisfier-1-…, exec_hgc5qwyv, walk-satisfier-2-…]`.
- Tasks:
  1. `out_shapes [code_read_lines]`, `out_ids [walk-code_read_lines-3]`;
  2. `in_shapes [code_read_lines]`, `in_ids [walk-code_read_lines-3]`, **`out_shapes []`**;
  3. **`in_shapes ["activity:⟨compose-auto-bridge-problem_detection-to-…⟩"]`**, `out [code_modification_proposal]`.
- The embedded engine trace `exec_hgc5qwyv` carries a **real** intra-template edge: task 2 has `input_shapes [problem_detection]` and `input_impulse_ids [disc:problem_detection_k7k0a6ua]`, which task 1 produced.

So the form exists and is populated. Its walk-level edges are positional, and on mixed chains one of them is a template id.

**Floor** `universal-tool-fallback-92b61822-1790870588818` (10-01 16:03Z):
- `tasks: []`, `input_impulses: []`, `output_impulses: []`, `trace.tasks: null`, no composition chain;
- metadata `tools_total 0`;
- its `final_text` (2,060 chars) narrates running `check-shape-dispatch-all.sh` and querying gaps. Those tool runs happened inside llm-resolver and are not on the trace.

**Where the floor's observations actually are.**
- llm-resolver returns `{content: <final text>, tool_calls: [{iteration, tool_name, tool_input, tool_output, duration_ms}], iterations, usage}` (`llm-resolver-vessel src/index.ts:804`, `:812`, `:946`).
- development-vessel `llm-completion-dispatch.ts:450-472` looks for `tool_calls` **inside `content`**, a string. It never reads the top-level `rawBody.tool_calls`, and returns `llmTextCompletion`.
- That is the open gap `floor-tools-counter-reads-zero-because-llm-resolver-runs-the-tool-loop-and-dev-vessel-drops-its-tool-calls` (09-30, `edit_site` = that file, `falsifier: none`).
- The structured observation records, each one already the pair of a shape name and its result, are dropped one hop before goal-host.

---

## 3. Q3: what must change so that a floor trace has the same form as a walk composition

**The fields the consumers read, and the floor's value today:**

| Consumer | Field read | Floor value today |
|---|---|---|
| ribosome eligibility | `tags` include `reached:true` (`ribosome-vessel src/index.ts:460`), **and** `completed > 0 && failed === 0` from the task census (`:310-321`) | 0 tasks ⇒ never eligible (which is also why `learned-universal-tool-fallback` stopped recurring: chunk-27 #1) |
| ribosome extraction (`executionTraceWithSignatures`) | per-task `input_impulse_ids`, `output_impulse_ids`, `input_shapes`, `output_shapes`, `composition_chain`, ids joined to `impulse` | all empty |
| in-walk credit gate | `consumedInChain` (ledger edges) | the floor has no ledger |
| `recordGoalPath` / pathway reuse | `path_activities`, `endpoint_output_shapes`, `expected_output_shapes`, `tools_used` | `["universal-tool-fallback"]`, requested targets, none |
| backward-chaining discovery | the minted template's `input_shapes`/`output_shapes` | nothing is minted |

**What would have to change, in dependency order:**

0. **The observation record must reach goal-host.** Every floor tool call in the window ran inside llm-resolver (S2, S3). Until dev-vessel `llm-completion-dispatch.ts` forwards the top-level executed `tool_calls`, goal-host has nothing to emit.
   - Forward them as executed records, **not** as pending `llmToolCalls`; the gap warns that would execute every tool twice.
   - Carry the dispatch/execution id on every call. local-tools logs `shell request WITHOUT execution_id` for these calls, for example 10-01 16:03:43Z.
1. **Each executed call becomes a walk-identical satisfier step.**
   - Shape = tool name. Every floor tool is already a registry shape resolved through discovery.
   - Output = one pool impulse with the call's result.
   - Persist it as a `walk-satisfier-*` trace with `templateId satisfier:<shape>`, through `persistSatisfierTrace`.
2. **Edges are declared only when bound** (Q5):
   - **Answer step.** It binds every observation by construction, because `iterPrompt` concatenates `observations` (`:5193`). Its inputs are therefore all observation impulse ids, minus any the 12,000-char cut removed, and the cut must be stated.
   - **Intermediate call.** It declares an edge to an earlier observation only when its args contain a literal token of at least 8 chars from that observation's content. That is the token test track 2 used at C9 (`14,125`). Otherwise `inputShapes: []`, and the step stays uncredited.
3. **The answer is a shaped impulse** consuming those ids (Q4). The final `chain` is
   `[satisfier:web_search, satisfier:http_fetch, …, satisfier:<answer shape>]`.
4. **The extractable artifact is the composite, never the floor row.**
   - If the floor's own `universal-tool-fallback` row gained successful tasks and kept its `reached:true` tag, the ribosome's predicate (`:460` plus the census) would extract it. That would re-mint `learned-universal-tool-fallback`, the recurrence of `minted-copy-of-the-floor-shadows-the-floor` (raw/memory-8.md:439, 3/32).
   - So the floor row stays a summary carrying the verdict, and its steps live in their own satisfier rows (untagged satellites).
   - The mintable unit is `walk-composite-<shape-slug>` with `templateId composition:<slug>`. Its slug comes from shapes, so backward-chaining can find it by output shape.
5. **The path row carries the chain.**
   - `recordGoalPath(goal, chain, …, "universal_tool_fallback", <shapes produced by the steps>, target, null, <tools used>)`, instead of `["universal-tool-fallback"]` with the requested targets.
   - `endpoint_output_shapes` must be what was produced (S6: 550/578 equal the request today).

**Reuse, not mint (law 3), and the one place reuse imports a defect.**

| Organ | Callable from the floor? | Verdict |
|---|---|---|
| `persistSatisfierTrace`, `recordGoalPath`, `mintReachedTrace` | yes (module-level) | reuse as is |
| `buildCompositeTraceFromChain` | yes (module-level) | **extend, don't call unchanged.** Its edges are positional (`:7012-7016`), which contradicts "declare only when bound". On mixed chains it already writes a template id as an input shape (S10: 9/178). Extend it with an explicit per-step edge argument (`{inputs: impulseId[]}` taken from the consumption ledger), then use it for both the walk and the floor. The positional fallback stays for callers that pass none. |
| `mkImpulse` / `addToPool` / `ledgerStep` | no: closures inside `runGoalAsPoolWalk` (`:7543`, `:9762`) | lift them into a small module-level pool object (`mkImpulse` + first-wins + `poolEvents` + ledger) that both the walk and the floor instantiate. Do not write a floor-side copy; that would be the third copy of the class REALIGNMENT §2.0 names. |
| `poolProvenance` / `goalWalkState` | via the dispatch record | the floor's impulses mirror into the same `rec.poolProvenance`, so the surface already renders them |

**What reuse cannot fix without a contract change.**
- **Pool ids.** `walk-<shape>-<n>` is per-walk and collides across walks (§0.4), and the signature join reads the `impulse` table (`:683`). An "indistinguishable" floor trace inherits shape-only extraction, like every walk trace today.
- **The fix.** Ids must be unique per dispatch, for example `walk-<dispatchId8>-<shape>-<n>`, or the extractor must stop joining to a table nobody writes walk impulses into.
- **Status.** This is a contract decision for the crystallization input (dossier composition-crystallization §3, "declared input contract"). It is **not new**.

**§9.0 boundary.** Everything above is on the recording side: the floor's existing calls emit impulses, steps,
edges and a composite, and no new address becomes resolvable or writable. Widening the floor's tool list from
`UNIVERSAL_READ_TOOLS` to the full registry (design item 1) does open addresses: `ufResolveUrl` goes through
discovery `/resolve` fan-out, which §9.0 says can return foreign producers for local shapes. **That widening is
held by §9.0**, and nothing in this track depends on it.

---

## 4. Q4: the answer as a shaped impulse (`goal_answer`, `human_presentation`)

**Where they are emitted.**
- Only in the walk's reach branch: `if (reached === true) { answerBody = …; addToPool("goal_answer", answerBody, …) }` (`index.ts:11447-11457`).
- `human_presentation` follows it: `buildHumanPresentation`, `:7324`, emitted at `:11462-11470`.
- Both are added **after** the verdict, to a pool that dies with the walk.

**Who consumes them.**
- **No one** reads them as impulses. A grep of every `/vessels/*/src` `.ts` for `goal_answer|human_presentation` finds only goal-host's emitters, plus one ias-executor seed template JSON.
- The human surface bundle reads `answerBody` (a string on the dispatch record) and `poolProvenance`. `"goal_answer"` appears in the bundle only as a default display label (`human-surface-vessel ui/dist/assets/index-*.js`).
- `a72ad1a`'s own commit says "threading the shape into the dispatch record for the plugin to render" was the unbuilt fast-follow.

**Why post-reach only.**
- `9a9fef6` (07-07) built `answerBody` + `goal_answer` as the **answer-delivery reach gate**: "question/request goals no longer reach on seed-only completion shapes; a genuine reach produces a decision-ready markdown answerBody + goal_answer".
- `a72ad1a` (07-26) added `human_presentation` "on a reached answer path", and declared it unlearned ("relevance is a deterministic placeholder", "no render-execution traces").
- The answer was designed as the *product of* a reach, not as the thing judged.

**The floor already does the opposite.**
- The answer (`finalText`) exists before the judge.
- The judge reads a 6,000-char cut of it, or a scratchpad dump when no number is stated (`:5462-5464`, `:5485`).
- It is returned as `answerBody` only on reach (`:5616`). The trace keeps 4,000 chars in `metadata.final_text` (`:5590`).

**Could the floor's answer be that impulse, consuming the evidence ids, before judging?** Yes, and the step
exists already. A lesson is teaching only if it has a reader at use time, and this one would have two:
1. **The judge.** `verifyGoalReached` grades the answer impulse's content at full length, plus its declared evidence ids, rather than `_digestBase`. That is design item (3), and track 4's G2 ("deliverable first at full length, then evidence as URL/title lines").
2. **The surface.** `answerBody` is built from that impulse **whether reached or not**, labelled `not reached — best attempt (k of n)`.

The second is APPROACH Step 1 ("always build `answerBody`") plus the open gap
`goalwalkstate-discards-prior-walk-attempts-within-a-dispatch` (bounded `priorAttempts` with per-shape content).
**Already proposed. Not new.**

Two constraints carry over from APPROACH Step 1:
- A not-reached answer impulse never feeds credit, `goal_answer` concept writeback, or `human_presentation`'s `reach_state:"reached"`.
- The answer's shape name must not be guessed. The gap store holds 6 capability gaps for invented answer shapes (`gap-answer` open; `gap-directanswer`, `gap-direct-answer`, `gap-statusdifferenceanswer`, `gap-numeric-answer-memorynote`, `gap-numeric-answer-storage` closed), which is the "850 capability rows over 850 names" pattern from track 3. Use the one existing name, `goal_answer`, rather than mint a new shape (law 3).

---

## 5. Q5: consumption-edge discipline and the drift at `index.ts:10222`

**The design.** CONSUMPTION-EDGE-ANALYSIS.md, ratified 09-22, says:
- "declare consumption ONLY where a step was actually bound from an earlier step's output";
- "Where the satisfier did not consume (independent resolve), it must keep inputShapes empty";
- mitigate over-declaring "by declaring ONLY when the downstream step was actually bound (boundBody / boundFindings non-empty and sourced from that shape)".

**The code** (`index.ts:10222-10227`) declares on the shape name alone:
```
const _consumedInputs = (satisfiableNow === "llmCompletion" || satisfiableNow === "llm_completion" || terminalShapes.has(satisfiableNow))
  ? [...chainProduced].filter((s) => s !== "goal" && s !== satisfiableNow && !terminalShapes.has(s))
  : [];
```
- It never checks whether `boundFindingsFromIntermediates` returned anything.
- That function returns `""` whenever `terminalShapes` is empty, which is every re-frame: 388/388 pass `terminalOutputShapes: undefined` (track 2 C6).
- It also returns `""` when the extractor supplied its own `prompt`.

**Measured in the store** (all retained llm satisfier rows, 83 = 27 `satisfier:llm_completion` + 56 `satisfier:llmCompletion`, 09-25 → 10-01):
- **46/83** carry task-level `input_shapes` and `input_impulse_ids`; 37 carry none.
- **The store holds the must-fail control.** Rows at **09-30 15:57Z** (`web_search,webSearchResult`) and **10-01 08:57–08:59Z** (`web_search` ×3) declare `web_search` consumed.
- These are track 2's unbound re-frame cases (C5): their llm_completion outputs were "as of June 2024" and "June 7, 2024", from a goal-only prompt.
- So the durable graph records a web_search → llm_completion edge that did not carry data. That edge feeds `consumedInChain` (`:9792`), so it unlocks α-credit (`:11431`) and composite grounding (`:11720`, `isGroundedHonestReach`).

**How floor edges must be declared.** Same rule; §3 step 2 states the predicate:
- the answer step binds every observation by construction (verifiable from the prompt it sent);
- an intermediate tool call declares an edge only on a literal-token match against a prior observation;
- a failed call's output is never an input. This is the same exclusion track 2 P4 asks of `boundFindingsFromIntermediates`.

**Prior repairs of this edge, and what happened.**
- `b36f0ef` (09-22, operator bypass) introduced the declaration.
- `69fe835` (09-23, substrate-authored, gap `satisfier-traces-record-no-input-impulses-…`, closed) added the trace-level `inputImpulseIds`/`inputShapes` at `:10226`. It **held** as plumbing: 46/83 rows now carry edges.
- Both encoded "llm_completion consumes everything produced" rather than "consumes what was bound". The drift was there from the first commit, not introduced later.
- Two open gaps, `consumption-gap-2026-09-23` and `goal-host-vessel-consumption-issue` ("4,335 reach verdicts withheld"), still read as the opposite complaint, too few edges. Both have `falsifier: none` and `edit_site: null`. Closing them by declaring more edges would be the gaming that CONSUMPTION-EDGE-ANALYSIS forbids.

---

## 6. Prior art (searched before proposing)

**goal-host `git log origin/dev -S`**

| Commit | What was tried | What happened |
|---|---|---|
| `4947765` (06-24) `mkImpulse` | shape-graph walk with an in-process impulse pool | **Held** as the pool. Ids were per-walk from day one; that was never revisited. |
| `ffae04f` (06-30) `buildCompositeTraceFromChain` | mint a 2-step satisfier composition as one recipe | Held for satisfier-only chains. Its positional edges are the pattern this report flags. |
| `27cc619` (07-25) `inputShapes: prevSh` | minted templates carried `walk-…` impulse ids as input shapes and were unbindable; fixed by giving composites a canonical predecessor shape. A class detector rejecting `^walk-` shapes was filed. | **Held for one prefix, recurred under another.** On mixed chains `shapeOf(templateId)` writes `activity:⟨…⟩` as an input shape (S10: 9/178). The minted `learned-composition-activity-learned-composition-substrate-health-tick-to-vessel-hea` has `input_shapes` = the embedded template's internals (`filePaths, llm_completion_result, problem_detection, httpResponse, json_extracted_value`), not its entry. |
| `ced125b` (07-25) `poolProvenance` | make pool content attributable to intent at any moment | Held as display. `producedBy` stayed the constant `"goal-host-walk"`. "Ribosome-extract emitting goalSignature" was left as a consumer follow-up. |
| `43247db` / `6cba611` (07-23) | real grounded ReAct floor, a shared `runGroundedToolLoop`, through the agentic wrapper | Held as a loop. Because it chose the wrapper path, tool execution moved to llm-resolver, and its records are dropped at dev-vessel (§2.3). |
| `8ee6c66` (08-06) | the floor's execution id named no row; persist it | **Held** (1,824 rows). |
| `c033664` (08-06) | the floor "wrote 0 of 4,768 path rows" (`return uf` above every recordGoalPath); add the floor's path row | **Held** (1,778 rows), but as a one-node path with requested shapes. |
| `2d980fe` (08-06) | a recommended floor pathway was un-actionable; run the floor directly on reuse | Held. Reuse is of an opaque node, so there is no first- or last-mile to adapt. |
| `8928e59` (08-09) | "a reach nobody can read is not evidence": persist `final_text` (cap 4,000) and `completion_shapes` | Held, with completion = request (S6). |
| `6d96a81` (08-27) | the floor's completion_shapes fallback never fired on `[]` | **Held** (0/66 empty in the window). |
| `b36f0ef` / `69fe835` (09-22/23) | declare consumed inputs on llm/terminal satisfiers | Held as plumbing. Drifted from bound-only (§5). |
| `9a9fef6` (07-07) / `a72ad1a` (07-26) | `goal_answer` / `human_presentation` on reach | Emitted, **0 readers** (§4). |

**Realignment records**
- `dossiers/composition-crystallization.md`:
  - 4 builds of extraction and about 13 repair episodes, each "re-pointed one reader at the current address of one signal";
  - the missing piece is "a declared, continuously probed input contract for crystallization" (§3);
  - root cause 4: "satisfier steps declare no inputs, so no edge forms". This report adds that, where they now do, the edges are partly false (§5).
- `raw/memory-4.md:63`, `:613` and `raw/memory-6.md:147`, `:417`: "floor wrote 0 of 4,768 path rows (`return uf` before recordGoalPath)", later fixed by `c033664`. The row now exists, but carries no steps.
- `raw/memory-6.md:182`, `:508`; `classes/_mech_chunks/11.json:408-413`:
  - "`{{shape}}` deterministic reference mechanism has ZERO uses (09-03)";
  - "pool reached the prompt in wrong form: `- <shape>: <content 800 chars>` prose … Persuasion is not mechanism";
  - `mechanisms/chunk-11.md:46` folds `{{shape}}` into slot-binding (9,745 successes).
  - The floor is the extreme case: its observations are prompt prose only, with no `{{shape}}` path at all.
- `mechanisms/chunk-11.md:41`: failure memory is "prompt-only". In the 16:04Z `a30a893c` run, failure-memory recorded the **walk's** pick (`learned-composition-problem-detection-to-obsidian-write-note`, 5 on record) and nothing about the floor's own failure ("missing API keys for the news services"). The floor's failure is not located at a step (design item 5, for track C or E).
- `mechanisms/chunk-24.md:47`: the change-series orchestrator (c24) "fires, does nothing" (0 `changeSeriesPlan`). It is the cross-dispatch output-chaining organ REALIGNMENT §2.0b names, and is out of scope here.
- `mechanisms/chunk-27.md:24`: "No `learned-universal-tool-fallback` row exists any more". That holds today (0 `activity` ids match).
- `raw/memory-8.md:439`: `minted-copy-of-the-floor-shadows-the-floor` (3/32). §3 step 4 is the guard against its recurrence.

**Gap store** (filtered)
- `floor-tools-counter-reads-zero-…` (open, 09-30): the prerequisite (§3 step 0). `falsifier: none`, although the summary contains one ("a floor run on the line-count question … shows tools>0 and groundedOk>0").
- `goalwalkstate-discards-prior-walk-attempts-within-a-dispatch` (open, `edit_site` goal-host index.ts, `falsifier: none`): §4.
- `consumption-gap-2026-09-23` and `goal-host-vessel-consumption-issue` (open, no edit_site, no falsifier): §5. They point the wrong way.
- `satisfier-traces-record-no-input-impulses-…` (closed by `69fe835`).

---

## 7. Proposals

Builder labels follow REALIGNMENT §2.0. goal-host `index.ts` is in `autonomyScope.excluded_paths`, so seams there
are **(a) operator bootstrap**: attempt budget, TTL, operator identity, an L12 record, one change per landing. The
dev-vessel resolver is not among the 27 excluded paths recorded in `raw/live-pool-memory.md:93-97`, so it is
**probably (b)**. I did not read the live `autonomyScope` record; verify before dispatch.

**B0. Forward the executed tool records (prerequisite).**
- **Seam:** development-vessel `src/resolvers/llm-completion-dispatch.ts:450-490`.
- **Change:** when `rawBody.tool_calls` holds executed records (`tool_output` present), return them beside the text as an executed-observation list. They must never be returned as pending `llmToolCalls`. Also stamp the dispatch's execution id on each record.
- **Gate:** a floor verdict line with `groundedOk > 0` whenever llm-resolver reported ≥ 1 successful `tool_calls` entry for that request.
- **Verification:**
  - **Positive:** the line-count question that the gap names, with `tools > 0` and `groundedOk > 0`.
  - **Must-fail:** a prompt with no tools field still yields `tools=0/0`, and no tool runs twice (local-tools receives exactly one request per record).
- **Trap: the gap's own falsifier can be gamed toward a known recurrence.**
  - The natural patch is "count the forwarded records into `executed`". But the floor row's `tasks` is `executed.map(…)` with `success: e.ok` (`index.ts:5538-5547`).
  - All-successful forwarded records on a reach therefore give `completed > 0 && failed === 0` plus `reached:true`. That makes the row ribosome-eligible (`:460` plus the census), and `learned-universal-tool-fallback` is re-minted.
  - So the counter must move **without populating the floor row's `tasks`**. Carry the records on a separate field, which goal-host reads for `groundedOk` and for B3's step emission, never inside `executed`.
  - B3 must-fail (ii) is the check, and it must ship with B0, not later.
- **Builder:** (b), after verification.
- **Status:** **already filed** (the open gap). This proposal supplies the falsifier the gap lacks, and the guard that falsifier needs.

**B1. One pool object for the walk and the floor.**
- **Seam:** lift `mkImpulse`, `addToPool`, `ledgerStep` and the `poolEvents`/`poolProvenance` mirror out of `runGoalAsPoolWalk` (`index.ts:7543-7562`, `9750-9794`, `9808-9837`) into a module-level factory.
- **Change, small parts only:**
  - `producedBy` = the actual producer (`satisfier:<shape>` / template id / `floor:<tool>`), not the constant;
  - the impulse id becomes unique per dispatch;
  - each impulse records `producerExecutionId` and `consumedIds`.
- **Gate:** every `poolProvenance` entry has `producedBy ≠ "goal-host-walk"` and an id unique within the dispatch.
- **Verification:**
  - **Positive:** a walk whose pool shows distinct producers.
  - **Must-fail:** today's records (100% `"goal-host-walk"`).
- **Builder:** (a).
- **Status:** extends `ced125b`. **New** as a shared object.

**B2. `buildCompositeTraceFromChain` takes real edges.**
- **Seam:** `index.ts:6981-7052`.
- **Change:** take an optional per-step `inputs` list from the B1 ledger, and use it in place of `prevSh`/`prevId`. A template step's shape is the step's actual produced shape, never `shapeOf(templateId)`.
- **Gate:** no composite task has an input shape that is a template id or a `walk-` id. This extends 27cc619's own detector (`^walk-`) to `^activity:` / `⟨`.
- **Verification:**
  - **Must-fail:** today's 9/178.
  - **Positive:** the 169 satisfier-only composites keep identical edges where the ledger agrees.
- **Builder:** (a).
- **Status:** a recurrence of `27cc619`'s class, so **not new**.

**B3. The floor emits impulses, steps and a composite.**
- **Seam:** `runGroundedToolLoop` / `universalToolFallback` (`index.ts:5134-5616`), using B0's records, B1 and B2.
- **Change:**
  - each executed record becomes one pool impulse and one `walk-satisfier-*` trace;
  - edges follow §3 step 2;
  - the answer becomes a `goal_answer` impulse whose inputs are all observation ids still present in the prompt;
  - on reach, `buildCompositeTraceFromChain` and `mintReachedTrace` are called on the composite, and `recordGoalPath` gets the chain, the produced shapes and `tools_used`.
  - The `universal-tool-fallback` summary row keeps **no tasks**, so it stays outside ribosome eligibility.
- **Gate (deterministic):**
  - a floor reach whose run executed ≥ 2 shapes writes a `composition:<shape-slug>` row with ≥ 2 tasks;
  - its path row has `path_activities.length ≥ 2`;
  - its `endpoint_output_shapes` ⊆ the shapes actually produced.
- **Verification:**
  - **Positive:** a floor reach on the `a30a893c` class (web_search → answer) mints `learned-composition-web-search-to-goal-answer`. The *next* identical goal finds it by backward-chaining on `goal_answer` and runs it without the floor; that is the 09-18 crystallization signature, a consult-count drop.
  - **Must-fail controls:**
    - (i) a floor run whose answer contains no token from any observation declares no observation → answer edge, and its composite is not grounded;
    - (ii) no `activity` row whose id matches `universal-tool-fallback` appears (guarding against the shadows-the-floor recurrence);
    - (iii) S6's request-equals-produced pattern does not appear on new floor path rows.
- **Builder:** (a).
- **Status:** this is design items (2) and (4), and REALIGNMENT §2.0b (the floor emits per step). **Partly new**: no prior attempt modelled floor tool calls as walk steps.

**B4. Declare consumption only when bound (the §5 drift).**
- **Seam:** `index.ts:10222-10227`, plus `vesselResolveShape` returning a `bound: string[]` (the shapes present in the prompt or body it sent).
- **Change:** `_consumedInputs = bound`.
- **Gate:** for each llm satisfier trace, `input_shapes` = the shapes present in the prompt that was sent.
- **Verification:**
  - **Must-fail:** a re-frame replay on the parent sha declares `web_search` (as in the stored 09-30 15:57Z and 10-01 08:57–08:59Z rows).
  - **Positive:** the main-walk replay (cea3f4a4 #1, bound) still declares it.
- **Builder:** (a).
- **Status:** **already** track 2 P6 and CONSUMPTION-EDGE-ANALYSIS. The two "too few edges" gaps should be re-scoped or closed with that reasoning, not satisfied by adding edges.

**B5. The answer impulse is read before judging.**
- **Seam:** the floor's `verifyGoalReached` call (`index.ts:5462-5485`) and the walk's (`:14404`).
- **Change:** pass the `goal_answer` impulse content at full length, plus its evidence ids rendered as source lines.
- **Builder:** (a).
- **Status:** **already** track 4 G2, APPROACH Step 1/3 and §9.2 (abstain on a cut). Listed here only as B3's dependency.

**Order:** B0 → B4 (it is independent and stops false edges entering credit now) → B1 → B2 → B3 → B5. Each one
lands alone (law 12).

**Detector (law 6).** One §2.1 evaluator row: "every reached execution whose tier is `universal_tool_fallback`
has a sibling `composition:*` row with ≥ 2 tasks, or a stated reason why not (single shape)".
- **Must-fail today:** 304/304 reached floor rows have none.
- It would have fired on 08-06, the day `c033664` recorded the floor's path as a single node.
