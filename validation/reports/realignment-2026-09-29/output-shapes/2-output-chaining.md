# Output shapes, link 2: data binding between steps, and how retries and re-frames rebuild the chain

Read-only investigation, 2026-10-01. Nothing was dispatched, written, restarted or committed.

**Sources**
- Live goal-host source `/vessels/goal-host-vessel/src/index.ts`. It is byte-identical to `origin/dev` `76bb373`. Every `index.ts:N` below refers to that file. The local `repos/goal-host-vessel` has uncommitted edits that belong to someone else, so its line numbers differ.
- `goal-host-vessel` journal, retained from 2026-09-26T10:12Z to 2026-10-01T11:08Z.
- Execution records `GET :18210/executions/<id>`.
- activity-api execution-traces and templates, read with GET only.
- Gap store `/workspace/git/super-repo/gaps/gaps.json`, 6,796 rows.

**Window notes**
- `HOLLOW-CONTENT` logging starts at 2026-09-26T12:15Z. Every HOLLOW-CONTENT count uses the window from 09-26T12:15Z to 10-01T11:08Z.
- The web_search goal family first appears at 2026-09-30T14:00Z, so its counts cover about 21 hours.
- REALIGNMENT.md has no §9; it ends at §8.

## 0. Corrections to the brief's premises

1. **5bef2e86 attempt 1: the placeholder text did not come from the llm_completion step.**
   - `## Today's Report: [Current Date] … Headline 1 [Brief commentary…]` is the shape **`llm_completion_result`**. The `synthesize_content` task of `activity:⟨auto-bridge-obsidian:write_note⟩` produced it.
   - That task's template has `inputShapes:["goal"]` and the prompt `"…Read the goal below and output ONLY the exact content…\n\nGOAL:\n{{goal}}"` (read from activity-api templates). By construction it cannot consume web_search.
   - The judge chose `completion_shapes=["llm_completion_result"]`. The `llm_completion` satisfier did run in that attempt, after web_search. The `reach-input` line lists both `web_search` and `llm_completion` in the pool.
   - The satisfier's actual output is **unrecorded**: HOLLOW-CONTENT prints only the shapes the judge selected, and the trace store keeps no content. So "search results did not reach the writer" is wrong for the writer that was judged. For the satisfier writer it is unknown, not shown negative.
2. **"FEEDBACK-RETRY — re-running the same chain" does not re-run the chain.**
   - `index.ts:13307-13324` calls a fresh `runGoalAsPoolWalk`: new pool, new `satisfierTried`, `disableReuse:true`, plus `priorVerdictFeedback`.
   - It passes `preferPathway: reachingPathway?.activities`, which is empty for this goal ("0 accepted").
   - Nothing produced in attempt 1 (here, `web_search`) is carried into attempt 2. Every intermediate is derived again from scratch.

## 1. How a step's input is built from the pool

| Seam | What it does | Cite |
|---|---|---|
| `rawResolve` llm_completion branch | Runs **only if the synthesized pointer has no `prompt`**. Prompt = `[priorVerdictFeedback preamble] + goal + "Produce the FINAL artifact … (the clustered classes, each with member gap ids and a testable invariant) … Analyze ONLY the records below … --- PRODUCED INPUT DATA ---" + boundFindingsFromIntermediates().slice(0,120000)`. If the findings are empty, prompt = preamble + goal. `max_tokens` is at least 4096. **No current date is injected.** | `index.ts:8173-8193` |
| `boundFindingsFromIntermediates` | `if (terminalShapes.size === 0) return ""`. Otherwise it dumps **every** pool impulse that is not a terminal and not the goal, as `## <shape>` plus JSON sliced to 8000 chars. There is no provenance filter: it includes `dispatch_id`, `filePaths`, `activity_template` (7,247 chars of template listing), `error`, and outputs of **failed** template steps. | `index.ts:8331-8345` |
| `llmExtractPointerArgs` | The arg synthesizer. It does get `temporalGrounding` (the current date). It sees prior findings as `- <shape>: <content sliced to 800>`, with terminals excluded. There is no `resolver_schema` for llm_completion (development-vessel `resolver-schema.ts` has no entry), so the extractor guesses fields. Observed llm_completion arg keys: `path, content`, `dispatch_id, llm_completion_result`, `path, file_path, filePath` (13 provenance lines in the window). | `index.ts:7640-7790`, `7730`, `7760-7763` |
| `terminalShapes` | `new Set(opts.terminalOutputShapes ?? [])`. | `index.ts:7491` |
| Re-frame call | `terminalOutputShapes: undefined`. There is no `priorVerdictFeedback`. | `index.ts:13421-13433` |
| DERIVATION DEFERRAL (terminal waits for its intermediates) | Does nothing when `terminalShapes` is empty. | `index.ts:9898-9903` |
| Terminal-write body binding | `boundBody` exists only when `terminalShapes.has(shape)`. | `index.ts:8371` |
| Consumption declaration | **Every** llm_completion satisfier is declared to consume all `chainProduced` non-terminal shapes, whether or not its prompt bound them. | `index.ts:10222-10227` |
| Satisfier one-shot | `satisfierTried.add(shape)` before resolving, then **one** correction round on `lastRawResolveReason`. | `index.ts:8347-8348`, `9509-9515` |
| Last-chance un-poison | Fires only when the prior reason matches `/external-evidence failure\|…\|timeout\|empty content\|fetch (threw\|failed)/`. A refusal like **"query is required"** does not match. | `index.ts:10775-10781` |

**Consequences.**
- **Main walk** (terminal `obsidian:write_note` is set): an llm_completion satisfier that runs after web_search gets the search JSON in its prompt. This holds only if the extractor did not supply a `prompt`, which cannot be checked post hoc because the args provenance log drops values of 2,000 chars or more and the reach-input line truncates at 300 chars.
- **Re-frame walk** (`terminalShapes` empty): the llm_completion prompt is **goal text only**, with no evidence and no date.
- **Re-frame `*_write` satisfiers**: they are not deferred and get no bound body. Their content comes from the extractor's 800-char-per-shape view. That explains "memoryNote held only the first search hit".

## 2. Discriminating the attempts

| Attempt | Pool when the writer ran | Writer that was judged | Result | Mechanism |
|---|---|---|---|---|
| cea3f4a4 #1 (main) | web_search ("news headlines today 2026-10-01"), then llm_completion | `llm_completion` | Grounded. **Positive control:** the literal `14,125 feet` appears in both the web_search HOLLOW-CONTENT and the llm_completion HOLLOW-CONTENT. | bound branch, 8183-8190 |
| cea3f4a4 #2 (FEEDBACK-RETRY) | web_search rejected "query is required", then **corrected OK**, then llm_completion | `llm_completion` | Consistent with grounding: it cites Al Jazeera with a 2026-10-01 URL. Not overlap-verified, because this attempt's web_search block was not printed. | same |
| cea3f4a4 #3 (re-frame) | web_search (`query="What's happening today?"`) → llm_completion → memoryNote_write | all three | llm_completion says "as of June 7, 2024"; memoryNote holds one hit | `terminalOutputShapes: undefined` at 13429 → `""` at 8332 → goal-only prompt with no date |
| 5bef2e86 #1 (main) | web_search corrected OK → llm_completion → auto-bridge synth | `llm_completion_result` (bridge, goal-only) | Placeholders | bridge template binds `{{goal}}` only |
| 5bef2e86 #2 (FEEDBACK-RETRY) | web_search rejected **twice** "query is required" → `returned no content` → blacklisted → bridge synth (goal-only, invented headlines) → llm_completion binds **that** as "PRODUCED INPUT DATA" | `llm_completion_result` | Invented headlines; ends "no pick — missing shapes [web_search,…]" | one-shot `satisfierTried` + un-poison regex miss + no provenance filter |
| 5bef2e86 #3 (re-frame) | web_search → llm_completion → memoryNote_write | memoryNote | One headline | as cea3f4a4 #3 |

**The two retries run the same code path and differ in one stochastic event.**
- Both first web_search attempts were refused with "query is required". The single LLM correction round added `query` in cea3f4a4 and omitted it in 5bef2e86.
- After that, `satisfierTried` blacklists the shape, and the un-poison regex does not recognise a payload refusal.
- The walk then logs "missing shapes [web_search] have no producer or constructible payload". The producer exists. Its synthesized payload was refused twice, and the log line merges those two cases.
- Window rates: 17 "query is required" refusals, in 16 episodes. The correction succeeded in 15 and failed in 1 (that 1 is 5bef2e86).
- "query is required" fires on the first try because web_search has no `resolver_schema` and gets nothing from BIND-BEFORE-SYNTHESISE ("nothing bindable from the pool for web_search (1 required field, source=refusal)"), so the extractor guesses `url` or `type`.

**Earlier mode, already fixed.** 12 `HTTP 404 no resolver for 'http_fetch'` events, 09-30 14:58Z to 15:08Z. The extractor returned `type:http_fetch` and that overrode the shape. `7310fb0` (09-30 15:24Z, "the resolved shape is set last") fixed it. 0 events after. Gap `goal-host-rawresolve-lets-synthesized-args-override-the-resolved-shape-type` is still `open` with `operator_hold`, even though the fix is live. Its closure is pending, not new work.

**Unattributed.** 6 web_search `returned no content` events have no `rawResolve web_search:` line in the 25 lines before them: 09-30T19:09, 10-01T01:19, 01:21, 01:33, 01:35 and 03:18. The cause is unknown; candidates are an `endpointForShape` miss, empty content, or another route.

## 3. Census

| # | Measure | Count / denominator | Window and address |
|---|---|---|---|
| C1 | HOLLOW-CONTENT blocks carrying placeholders (`[Current Date]`, `Headline 1`, `[Brief`, `[Source`, `[Insert`, …) | **15 / 1,173** HOLLOW-CONTENT blocks; **15/15 are `llm_completion_result`** (of 80 `llm_completion_result` blocks) | 09-26T12:15Z–10-01T11:08Z, journal |
| C2 | Goals behind C1 | a30a893c (8), 4a4858b4 (6), fad02df8 (1). All three are web_search → … → `obsidian:write_note` goals. | same |
| C3 | `auto-bridge-obsidian:write_note` runs (writer bound to `{{goal}}` only) | 37 in the journal = 37 rows in the trace store (first run 09-30T14:59Z). In **20/37** the pool held web_search or webSearchResult when it ran, and in **32/37** some retrieval/compute shape. So 32 of its 37 runs ignored upstream data that was there. | trace store `input_impulse_shapes`, matched against the journal |
| C4 | Live LLM writer tasks whose prompt binds **only** `{{goal}}` | **16 / 1,294** LLM tasks (1,138 templates; 2,782 non-retired templates). 8 are `auto-bridge-*`: obsidian:write_note, source_code, problem_detection, uiQuestion, uiQuestion_write, fileWriteResult, emit_shape, codeInsertResult. 204 more have no placeholder at all. | activity-api templates (all 2,798, paged) |
| C5 | llm_completion satisfier content on news goals (all 7 llm_completion content blocks in the window were read; 5 are news) | **Main walk, web_search in pool and bound: 2/2 grounded.** #1 is overlap-verified; #2 is consistent with its sources but not overlap-verified, because its web_search block was never printed. **Re-frame, web_search present, prompt unbound: 2/2 recorded outputs stale**: 09-30 15:57 "as of June 2024"; 10-01 08:59 "June 7, 2024". The third news re-frame (5bef2e86 #3) has no recorded llm_completion output. **Main walk, web_search absent: 1 stale from bound junk**: 09-30 15:06 "October 4, 2023". web_search had failed (404 era), so the bound block carried the bridge's invented `llm_completion_result`, which is a P4 instance. | journal HOLLOW-CONTENT |
| C6 | Re-frames where an llm_completion satisfier ran after a retrieval shape, i.e. a prompt that structurally could not bind it | **3 / 385** closed re-frame segments. 388 `re-framing` lines; **all 388 pass `terminalOutputShapes: undefined`**. | journal |
| C7 | Re-frames where a `*_write` satisfier ran after upstream data (not deferred, body from the 800-char view) | **9 / 385** | journal |
| C8 | FEEDBACK-RETRY walks that ended "no pick — missing shapes […]" naming a shape **the pre-retry walk had produced** via a satisfier | **21 / 459** segmented retry walks (463 FEEDBACK-RETRY lines). Includes a30a893c web_search and 4a4858b4 web_search. **Caveat:** segmentation is by journal adjacency, and concurrent walks can interleave. | journal |
| C9 | Positive control through the same address | cea3f4a4 #1: `14,125` in both the web_search and llm_completion previews. The mechanism can bind when `terminalShapes` is set and web_search lands. | journal |

**Instrument limits** (each is itself a gap; see P6):
- HOLLOW-CONTENT shows 400 chars, and only for the judge-selected shapes.
- The reach-input `cmdEvidence` is cut at 300 chars.
- Arg provenance drops values of 2,000 chars or more.
- Neither the prompt actually sent to `llm_completion` nor its output for an unselected shape is recoverable after the fact. llm-resolver-vessel does not log prompts.

## 4. Prior art (searched before proposing)

**goal-host `git log -S`:**
- `ffae04f` (06-30): DERIVATION DEFERRAL and `boundFindingsFromIntermediates` for terminal writes.
- `b416bf0` (07-14, substrate-authored): introduced the re-frame with `terminalOutputShapes: undefined`. This has been the state for 2.5 months.
- `a1e9c12` (07-27): last-chance un-poison, limited to transient reasons.
- `13b3262` / `c07cffc` (09-02): BIND BEFORE SYNTHESISE. Binds required primitive fields, and is inert for web_search ("nothing bindable … source=refusal").
- `bf31c8a` (09-22, operator bypass): feeds pool records into the llm_completion prompt. It was written for the substrateGap-clustering family.
- `7bbd7e8` (09-22, operator bypass): hard-codes "the clustered classes, each with member gap ids and a testable invariant … Cover EVERY class" into that **universal** prompt.
- `b36f0ef` (09-22): declares consumption on bound satisfiers. CONSUMPTION-EDGE-ANALYSIS.md said to declare "ONLY when the downstream step was actually bound". The code at 10222 declares on shape name alone.
- `64ce0ac` (09-22): the FEEDBACK-RETRY feedback edge.
- `959519e`: execution_id on feedback-retry.
- `7310fb0` (09-30): shape set last.

**Gap store** (keyword filter on summary):
- `walk-synthesis-step-does-not-receive-the-pool-evidence-it-should-summarize` (open, human_reported, 09-30). It marks its mechanism **UNVERIFIED** ("the human-surface lane infers…"). §0.1 and C3/C4 verify it. The writer it saw was the bridge's goal-only synth task, not a binding failure of the llm_completion satisfier. Its falsifier ("synthesis prompt contains a headline from web_search") is the right one.
- `reach-judge-and-synthesis-lack-the-current-date-so-time-relative-goals-invert` (open). It records that **prompt-text date fixes failed before** (`8a85cfa`, `2c26fcb`) and asks for a deterministic check on a clock shape. Do not re-propose this as prompt text.
- `goal-target-inference-proposes-a-terminal-shape-no-producer-serves` (open). `obsidian:write_note` is unadvertised, so the bridge is minted and fails every run ("Resolver 'obsidian:write_note' is not registered"), yet its synth output still lands in the pool.
- `produced-llmcompletion-does-not-flow-into-the-deferred-memorynote-terminal-body` (open, 09-22): the terminal half of the same seam.
- `goalwalkstate-discards-prior-walk-attempts-within-a-dispatch` (open): observability of retries.
- `goal-host-rawresolve-lets-synthesized-args-override-the-resolved-shape-type` (open, operator_hold): fixed by `7310fb0`.

**realignment-2026-09-29**
- §2.0b names output chaining and the change-series orchestrator (c24) as the nearest organ. `mechanisms/chunk-24.md:47` says it "fires, does nothing": 0 `changeSeriesPlan` impulses, untraced fire-and-forget.
- `mechanisms/chunk-11.md:41` keeps failure memory and FEEDBACK-RETRY general ("feeds the walk only, prompt-only").
- `raw/memory-7.md:39` records the same bridge class earlier: "auto-bridge-source_code (templateInputShapes=[goal]) universally bindable out-selects satisfier".
- No dossier or class covers re-frame binding or goal-only bridge writers.

## 5. Proposals

Builder labels follow REALIGNMENT §2.0. goal-host `index.ts` is in `autonomyScope.excluded_paths`, so every seam in it is **(a) operator bootstrap**: it needs an attempt budget, a TTL, operator identity and an L12 record. Change one thing per landing (law 12).

**P1. A re-frame keeps the evidence it already has, and the terminals it implies.**
- **Seam:** the re-frame call at `index.ts:13421-13433`, plus `boundFindingsFromIntermediates` at `8331-8332`.
- **Change:**
  - Derive the terminals from the alternative list. The existing `derivation-intent` split already computes `terminal_shapes` for the primary list; apply the same function to `altShapes`. Pass the result instead of `undefined`.
  - Let the llm_completion branch bind findings when `terminalShapes` is empty. The `size===0` guard was written for terminal writes.
- **Gate (deterministic):** when an llm_completion satisfier runs while the pool holds any non-goal intermediate, the prompt sent contains `--- PRODUCED INPUT DATA ---`. Log one line with the prompt length and the list of bound shapes. That also fixes the observability hole.
- **Verification:**
  - **Positive:** replay goal_hash a30a893c. In the re-frame walk, the llm_completion output contains at least one ≥8-char token from that walk's web_search `results[].title` (cea3f4a4 #1 shows the token test works).
  - **Must-fail:** on the parent sha, the same replay's re-frame llm_completion has no such token (C5: 2/2 recorded re-frame outputs).
  - Unit test: a pool with `{goal, web_search}`, `terminalShapes` empty, and a bound prompt that includes `web_search`.
- **Builder:** (a).
- **Status:** **New**, as the re-frame seam. It is the "a produced shape is offered to open goals that consume it" half of REALIGNMENT §2.0b, applied inside one dispatch.

**P2. A retry reuses what the previous attempt produced (output chaining inside a dispatch).**
- **Seam:** the FEEDBACK-RETRY and re-frame calls (`index.ts:13308-13324`, `13422`) and `runGoalAsPoolWalk` options.
- **Change:**
  - Pass the prior walk's produced **intermediate** impulses (successful satisfier outputs only, which ties to P4) as seeded pool entries.
  - Re-derive only the shapes the verdict names, plus the writer.
  - Rename the log to "re-deriving with the prior verdict" until then.
- **Gate:** a retry must not end "missing shapes [X]" when X was produced, successfully, by an earlier attempt of the same dispatch (C8: 21/459).
- **Verification:**
  - **Positive:** a replay where retry #2's first web_search synthesis is refused still has web_search in the pool, from the seed.
  - **Must-fail:** the parent sha reproduces 5bef2e86 #2's "missing shapes [web_search…]".
- **Builder:** (a) for the goal-host wiring. The cross-dispatch version (a produced shape offered to *other* open goals) belongs to the c24 change-series orchestrator, a dev-vessel path, so (b) once c24 has a reader.
- **Status:** **Already in REALIGNMENT §2.0b** (output chaining). This report adds the intra-dispatch instance and its count.

**P3. A refused payload is not "no producer", and gets one more bounded correction.**
- **Seam:** the un-poison regex at `index.ts:10775-10776`, the correction at `9509-9515`, and the message at `10832`.
- **Change:**
  - Add the resolver-refusal class (`/\b\w+ is required\b|missing_required_field/`) to the bounded un-poison. It is still capped at 1 by `satisfierRetry`.
  - Split the log into "no producer" and "producer refused synthesized payload: <reason>".
- **Gate:** count `no pick` lines whose missing shape has a live producer *and* a refusal reason. The target is 0 of them being worded "no producer".
- **Verification:**
  - **Positive:** a stubbed resolver that refuses twice, then accepts, ends produced.
  - **Must-fail:** a shape with no endpoint still logs "no producer".
- **Builder:** (a).
- **Status:** **New** wording and class. The transient un-poison exists (`a1e9c12`).
- **Better root:** web_search gets a `resolver_schema` contract (`required: query`). With it, the AUTHORITATIVE PAYLOAD CONTRACT block reaches the extractor and the first-try refusal rate (16 episodes in about 21 hours) should drop.
  - **Seam not yet pinned. Verify it before dispatching.** `llmExtractPointerArgs` asks the shape's *owning* endpoint (`endpointForShape`, `index.ts:7655`) for the schema. web_search is served by local-tools (:8230), and `repos/local-tools-vessel/src` has no `resolver_schema` handler. The table lives in development-vessel `resolver-schema.ts`.
  - The right fix is therefore one of two: local-tools answers `resolver_schema` for its shapes, or the schema lookup falls back to development-vessel's table. Which one is undecided. The BIND-BEFORE-SYNTHESISE comment records `known:false` for exactly the local-tools shapes (shellResult, webSearchResult, fs_edit).
  - Builder: (b) for the vessel holding the table. If the lookup fallback is chosen, it lives in goal-host and is (a).
  - Verification: "query is required" falls to 0 over the next 20 web_search satisfier calls, with the 15/16 correction rate as the baseline.

**P4. Bind only evidence: a provenance filter on `boundFindingsFromIntermediates`.**
- **Seam:** `index.ts:8331-8345`.
- **Change:** exclude impulses produced by a step whose status is `failed`, impulses produced by an LLM task whose only input is `goal`, and bookkeeping shapes (`dispatch_id`, `activity_template`, `error`, `filePaths`). Ideally this reads a shaped list (law 1), not a constant.
- **Gate:** the bound block never contains an impulse whose producing trace has `status:failure`.
- **Verification:**
  - **Positive:** replay 5bef2e86 #2's pool. The bound prompt holds no `llm_completion_result` from `exec_ew985wq5` (failed).
  - **Must-fail:** the parent sha binds it. That is the instance where invented headlines were laundered in as "PRODUCED INPUT DATA". A second instance: 09-30 15:06, where "October 4, 2023" came from a main walk with web_search failed.
- **Builder:** (a).
- **Status:** **New.** No prior commit or gap found.

**P5. Writers minted by the bridge author bind their upstream; the goal-only writers are retired as data.**
- **Seam:** goal-host's auto-bridge author, which writes `synthesize_content` with `inputShapes:["goal"]`.
- **Change:** the author lists the current non-goal pool shapes as optional inputs and adds a `{{findings}}` slot. The 16 goal-only LLM tasks (C4) are re-minted, or retired with a reason row.
- **Gate:** a template admission check refuses an LLM writer task whose prompt has no placeholder other than `{{goal}}` when its template's declared intent is "report/summarize/synthesize".
- **Verification:** C3 goes from 32/37 to 0 over the next N bridge runs. Must-fail: the gate refuses a re-submission of the current `auto-bridge-obsidian:write_note` row.
- **Builder:** (a) for the author code. Retiring the 16 rows is a data change on activity-api, (b).
- **Status:** Partly **already filed**. `goal-target-inference-proposes-a-terminal-shape-no-producer-serves` removes *this* bridge by not targeting an unadvertised shape. The goal-only writer class (16 templates) is **new**, and `raw/memory-7.md:39` saw the same class for `auto-bridge-source_code`.

**P6. Do not declare consumption that did not happen; record what was bound.**
- **Seam:** `index.ts:10222-10227`.
- **Change:** declare `_consumedInputs` for llm_completion only if `rawResolve` actually used the bound branch with non-empty findings. Return that fact from `vesselResolveShape`.
- **Gate:** a trace's `inputShapes` for `satisfier:llm_completion` equals the set of shapes present in the bound prompt.
- **Verification:**
  - **Positive:** main-walk replay; the edge is declared.
  - **Must-fail:** re-frame replay on the parent sha declares `web_search` consumed while the prompt was goal-only.
- **Builder:** (a).
- **Status:** **Already in** CONSUMPTION-EDGE-ANALYSIS.md ("declare ONLY when … actually bound") and REALIGNMENT §2.2 (credit must read a real verdict). The code drifted from that design.

**Hazard, not a demonstrated cause.** `7bbd7e8`'s gap-clustering instructions sit in the universal llm_completion prompt (`index.ts:8190`). cea3f4a4 #1's news report was graded "missing a coherent report format" after being told to emit "clustered classes … member gap ids". Attribution needs a one-change A/B. The current date belongs to the open date gap, as a clock-shape read at use time, not prompt text.

## 6. Handed to other tracks (not absorbed here)

- **Judge selection.** The judge picked `llm_completion_result` over `llm_completion` in 5bef2e86, and graded cea3f4a4 #1 against a completion set that included 7,247 chars of `activity_template` junk.
- **Ordering.** In the FEEDBACK-RETRY of 5bef2e86, a failed satisfier falls through to candidate selection in the same iteration. That is why the bridge ran at step 1, before llm_completion.
- **Unexplained date, which is a lead for the open date gap.**
  - The bridge's goal-only synth task produced the **correct** date with the correct weekday ("Thursday, October 1, 2026", 5bef2e86 #2), and so did 3 other bridge outputs in the provenance census ("Report: 2026-09-30").
  - Its prompt carries only `{{goal}}`.
  - That task runs through `llm_completion_dispatch` (development-vessel `src/resolvers/llm-completion-dispatch.ts`, reached through ias-executor `adapters/vessel-resolver.ts:96`). The satisfier instead goes through goal-host `rawResolve` → llm-resolver `llm_completion`, whose outputs were stale in the 2/2 unbound re-frames.
  - No date injection was found by grepping either llm-completion-dispatch.ts or llm-resolver-vessel/src. Where the date enters the dispatch path (a model or provider system prompt, routing, or something else) is unknown.
  - One path has the date and its sibling does not. That is the date gap's "landed on one path, missed its sibling" pattern, and it is worth locating.
- **Binding branch fires in general.** 0 of 13 llm_completion arg-provenance lines show `prompt=` among the leading keys. This is weak, truncated evidence that the extractor usually leaves `prompt` empty, so the bound branch (8175) usually fires.
