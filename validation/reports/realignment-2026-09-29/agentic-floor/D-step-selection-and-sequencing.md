# Agentic floor, track D: how each step is chosen, and how the walk and the floor are sequenced

2026-10-01. Read-only. No dispatches, no POSTs that change state, no restarts and no edits outside this file.
The only POSTs were discovery `vesselCapability` lookups and `resolver_schema` reads.

**Sources.**
- Live goal-host source: `/vessels/goal-host-vessel/src/index.ts` (18,114 lines) in `substrate-live`.
  It is byte-identical to `origin/dev` `76bb373` (per the shared brief). Every `index.ts:N` below is a live line number.
  The brief's "~4680-5600" range now sits at **4565-5600**.
- The retained goal-host journal on node 1. It begins **2026-09-26 11:22Z**; reads were taken up to about 10-01 16:30Z.
  Every count below is over that window, on node 1 only.
- REALIGNMENT is read from `origin/dev`, including §9.
- The output-shapes census (`output-shapes/APPROACH.md` and tracks 1–5) is cited, not redone.

---

## 0. Correction to the brief's premise (read this first)

**"On 10-01 the floor never ran for a30a893c" is false. The floor ran on 10-01 eight times for that goal hash. The dispatch record can't show it.**

The journal has `floor: ENTER universalToolFallback goalHash=a30a893c` at these times:
- **09-30:** 15:03, 15:09, 15:33, 15:57.
- **10-01:** 00:31, 01:25, 01:41 (`exit=no_dispatch_url`), 03:24, 06:25, **08:59** and **09:35**, then 16:04.

That is 12 entries and 11 verdicts. **All 11 were `reached=false tools=0/0`.**

The two motivating dispatches map to these entries by their FAILURE-RECALL line:
- `cea3f4a4` started 08:56. It recalls the 06:25 verdict, and its floor ran 08:59:30–08:59:55.
- `5bef2e86` started 09:31. It recalls the 08:59 verdict, and its floor ran 09:35:39–09:36:14. It is persisted as `universal-tool-fallback-a30a893c-1790847374795`.

**Why the record hides the floor.** Three mechanical reasons, all verified in source:
1. **Floor lines never reach the walk log.** The record's `walkLog` is filled only by `tap()` (`index.ts:7458`, `:12238`: `console.log(m); opts.stepSink?.push(m)`). `universalToolFallback` logs with `console.log` only.
2. **An unreached floor leaves the walk's fields on the record.** It falls through to `return walk` (`index.ts:13554`). So `selectedTemplateId` and `goalReachReason` on the record are the walk's, not the floor's.
3. **The floor trace has no link to its dispatch.** It carries `metadata.goal_hash`, but no `dispatch_id`, `composition_chain: null`, empty `input_impulses` / `output_impulses`, and `tasks: []`. Nothing joins it to the dispatch except the clock.

**This is the same instrument fault as the 09-29 row of the goal-walk-floor dossier.** That check-in said "the ReAct floor did not engage". The journal showed `floor: ENTER … goalHash=721b5154 targetShapes=[]`. It is a REALIGNMENT §6.2 row-1 instance ("instrument faults reported as system facts"), now twice in three days.

**The positive control for "the floor uses tools" is the floor's own `final_text`.** Three persisted a30a893c floor traces narrate the same story:
- They tried NewsAPI, CurrentsAPI and the NYT API by curl.
- The calls failed on missing or invalid keys.
- One trace states the date "based on the retrieved data".
- `tokens_in` was 40,445 for one floor run, which fits a multi-turn loop.

So tools ran inside llm-resolver's internal loop, and the record of them was discarded on the way back. The counter `tools=0/0` (`index.ts:5594`) is structurally zero:
- **Measured:** 439/439 persisted floor runs read `tools=0/0`, 110 of them reached.
- **Mechanism (read in source, not executed):**
  - llm-resolver runs the loop and returns `{content: <string>, tool_calls:[{tool_name, tool_input, tool_output}], …}` (`llm-resolver-vessel/src/index.ts:760-820`).
  - development-vessel `src/resolvers/llm-completion-dispatch.ts:451-472` looks for `tool_calls` only *inside* `content`. When `content` is a string it returns `llmTextCompletion {text}` and drops them.
- **Already filed:** gap `floor-tools-counter-reads-zero-because-llm-resolver-runs-the-tool-loop-and-dev-vessel-drops-its-tool-calls` (open; `edit_site` dev-vessel; `falsifier: none`). §7 P1 supplies the falsifier.

---

## 1. Q1: the floor's tool set, compared with the registry

### 1.1 What the floor offers (`universalToolFallback`, `index.ts:5295-5402`)

| Part | Where | How it is built |
|---|---|---|
| `UNIVERSAL_READ_TOOLS` | `index.ts:4565-4571` | **Hand-written.** Five entries: `source_code`, `fs_read`, `codeSearchResult`, `shellResult`, `substrateGap`. The names, descriptions and `input_schema` are literals. Born substrate-authored in `1cf0b96` (07-11, gap route-edit-38699a72) with four tools; `substrateGap` was added later. Not read from discovery, `resolver_schema` or the shape descriptions. |
| Write tools | `ufBuildWriteTool`, `index.ts:4600-4618`; filter at `:5390` | Only target shapes matching `/(_write\|_create_write)$/` become tools. The schema comes from the owning vessel's `resolver_schema` (envelope, fields, required). If the schema is unknown, it falls back fail-open to a one-field `{content: string}` stub. The description is a template string: "Perform the '<shape>' write/create action…". **It never reads `/registry/shape-descriptions`.** |
| `walkBudget` | `runGroundedToolLoop`, `index.ts:5143-5172` | A shaped impulse served by goal-host itself (`:17323`). Literal fallback 4/8/90 s/210 s. Live: `walkBudget SHAPED iters=8 calls=8 iterMs=90000 wallMs=210000`, 1,371 SHAPED against 19 FALLING BACK in the window. |
| Recipe seed | `recipeCommandFor`, `index.ts:4838`; seeding at `:5326-5352` | Fires only for the hand-coded `verifierFamilyOf` families when a goal-tree path parses. The dossier records 0 `recipeSeed` journal hits in 7 days to 09-29. Prior art: `1021176` → reverted `d73da0b` → restored `c671407` (08-07). |
| Investigation seed | `index.ts:5354-5388` | Fires only on `isCodeInvestigationGoal`/`isGapInvestigationGoal`. It runs a grep through `shellResult` and inlines the output as prompt text. |
| Prompt | `index.ts:5398` | Tells the model to "RETRIEVE it with curl through the shellResult tool". This is the instruction the a30a893c floor followed into news APIs that need keys. |

### 1.2 What the registry has that the floor does not offer

- Discovery `/registry/shapes` returns **407** shapes. `/registry/shape-descriptions` returns **81** descriptions.
  - APPROACH counted 56/407 and REALIGNMENT 312 on 09-29. The number moves; track 3 P5 covers that volatility, and it is not re-measured here.
- Producers were checked by a `vesselCapability` lookup (positive control: each shape returned live rows):

| Useful shape | Producer (local row) | Description? | `resolver_schema`? | Offered to the floor? |
|---|---|---|---|---|
| `web_search` / `webSearchResult` | local-tools `:8230`, plus peer libp2p rows | **none** | **none**: local-tools answers `no resolver for 'resolver_schema'`; dev-vessel answers `known:false` | **no** |
| `http_fetch` | development-vessel | yes, but its text is about "relevance backfill, problem detection…" rather than what it fetches | not checked | **no** |
| `llm_completion` | llm-resolver `:8220` | yes | — | **no**. The floor *is* an LLM call, so this only matters for a sub-synthesis step. |
| `memoryNote_write` | development-vessel | — | **yes**: dev-vessel `/v2/impulses/resolve` returns `known:true` with `title`/`body` required. This is the positive control for the schema read. | only if inference named it |
| `uiPanel_write` | stateful-ui `:8270`, dev-vessel, human-surface `:8310` | — | not checked | only if inference named it. It is unauthenticated (§9.0). |
| a date or time shape | **none**. 0 of 407 shape names match time/date/clock/now/calendar; only `*_tick` rhythm shapes exist. | — | — | — |

**The decisive fact for the motivating case.** In the same dispatch (`5bef2e86`, 09:35:19), the walk's `web_search` satisfier returned real results: NBC headlines, and the re-frame's Al Jazeera "Iran war live" item. Thirty seconds later the floor started without `web_search`, curled news APIs that need keys, and gave up.

Inference had named `web_search` as a target, but the write-suffix filter dropped it, and `obsidian:write_note` too (it is `:write_note`, not `_write`). So the floor saw five read tools and no search.

**Census of floor entries** (501 `floor: ENTER` lines in the window):
- **138** had at least one `_write` target, so the floor gained at least one write tool.
- **332** had targets, none of which became a tool. The top non-write targets: `problem_detection` 152, `trace_failure_pattern_report` 62, `shellResult` 49 (already a read tool), `code_modification_proposal` 39, `web_search` 15, `obsidian:write_note` 15.
- **31** had empty targets.

---

## 2. Q2: forward versus backward, and how a step is chosen

### 2.1 What the walk does today (`runGoalAsPoolWalk`, `index.ts:7393` onward)

Per iteration, in order:

**(0) Vessel-resolve satisfier** (`index.ts:9881-10245`). Resolve-first for a *missing target shape* that has a live resolver.
- **How the next shape is chosen:** by target order from inference, not by Thompson.
  - Terminals are deferred while intermediates are pending. This is "derivation-intent intermediates", from inference's own intermediate/terminal split (`:9892-9900`).
  - Executor shapes are deferred behind non-executor shapes (`:9905-9911`).
  - A composition probe through `/recommend` can pre-empt the satisfier (`:9963-10000`).
- **How the producer is chosen:** the satisfier resolves the shape through the walk's endpoint map / discovery. There is no choice among producers.
- **The decision record** has `source:"satisfier"` and `candidates: []` (`:10160`).
- **But the act is graded.** Each satisfier step:
  - persists a `walk-satisfier-N-<ts>` trace (`:10152`) with `outputShapes`, input and output impulse ids;
  - calls `addToPool`;
  - writes a consumption edge (`ledgerStep`);
  - updates its posterior under `satisfier:<shape>` (`thompson_posterior` resolve, `fetchSatisfierReliability`, `:6165`). The record shows "β-penalised last pick satisfier:memoryNote_write".
- **The posterior gate exists and is held.** It is behind the env flag `SATISFIER_PROVEN_BAD_ARMED` (`:9954`), described in source as a temporary interlock pending a posterior re-baseline.

**(a) Candidate generation** (`:10250-10290`). The consumers of the current pool, from `discover-by-shapes mode:"backward"` on `producedShapes`. If none come back, it falls back to `/recommend`.
- **(a2) Forward target-producer merge** (`6082c2e`, 07-31). Producers of missing targets (`mode:"forward"`) are unioned in.

**(b) Select.** Candidates arrive **sorted by Thompson sample**, server-side: activity-api `services/discover-by-shapes.ts:433` sorts by `sampled_score`.
- goal-host then stable-sorts by `scaffoldRank` and takes the first candidate that passes `feasibleProducer`. That includes the proven-bad gate `isIrrelevantLearnedComposite`: n ≥ 12 and α/n < 0.15.
- Horizontal OR-edge bundles are recorded with `source:"thompson"` and the alpha, beta and sample of each candidate.

**(c) Backward-chain** (`:10638-10680`). Producers of the missing targets; their declared inputs are pushed as sub-targets.
- **There is no posterior gate here.** This is track 3 §2.2 and APPROACH step 4. It is cited, not re-proposed.

**Is there a forward (observation-driven) mode?**
- **Only when there is no target.** At `:10630-10636`, when `target.size === 0` the pick is "any genuine forward progress" over pool consumers.
- That is the mode the 09-29 memory need (`721b5154`) fell into: inference returned `[]`, the walk ran pool leftovers, and the result was HOLLOW.
- **Nothing in the walk lets an observation change the next target.**
  - A re-frame swaps to inference's precomputed `alternatives` (`:13411-13505`), not to anything observed.
  - A re-frame passes `terminalOutputShapes: undefined` (track 2).
  - FEEDBACK-RETRY is a fresh walk with an empty pool and the verdict text in synthesis (APPROACH §0.2).

### 2.2 Could a floor step choose its next shape through the same selection?

**Partly, and through organs that already exist.** At each turn the LLM chooses *which tool*; that is the policy and it should stay so. What the substrate can grade is three things.

| Element | Graded today in the walk? | In the floor? |
|---|---|---|
| **The offer** (which shapes appear as tools) | Not applicable | Hand-written list (§1) |
| **The producer** of the chosen shape | No choice: one satisfier resolve | No choice. `ufResolveUrl` takes the first non-libp2p row (`:4579`). Inside llm-resolver, `resolveToolEndpoint` picks its own row. |
| **The act** (did resolving shape S here advance the goal) | Yes. A `satisfier:<shape>` trace and posterior, a pool impulse and a consumption edge (block `:10110-10245`). | **No.** No trace, no impulse, and the floor row has `tasks: []` because nothing came back (§0). |

The concrete reuse is to make each floor tool call go through the **satisfier step block at `index.ts:10110-10245`**: persist `walk-satisfier-N`, `addToPool`, `ledgerStep`, `recordStep`. It replaces the bare `ufExecuteTool` path.
- The floor already calls the same persister, `persistSatisfierTrace` (`:5528`), but with an empty chain and no impulses.
- Every act then becomes a graded `satisfier:<shape>` observation.
- The offer can then be **ordered** by those posteriors in the context bucket. That is the only place Thompson enters a tool-choosing loop without taking the choice away from the model.

This depends on §0's mechanism first: goal-host must see the tool calls. Today they are executed and discarded inside llm-resolver and development-vessel.

---

## 3. Q3: sequencing. When goal-host falls to the floor

### 3.1 The order in `runGoalWithRecoveryInner` (live lines)

1. Early edit-intent route and landed probe. Edit goals go to `feature_compose`.
2. `recommendReachingPath`. If the proven pathway is exactly `universal-tool-fallback` and the goal is neither an edit nor a durable artefact, **REUSE-BEFORE-DERIVE runs the floor first and skips the walk** (`:13213-13255`).
3. The walk (`:13259`).
4. **FEEDBACK-RETRY** (`:13295-13334`). It runs only if `goalReachReason` does **not** match `/no pick|no producer|missing shapes|constructible payload|terminating walk/`.
   - For a30a893c the walk ended in "no pick — missing shapes [obsidian:write_note]". But the judge then graded the pool and *its* prose became `goalReachReason`, so the structural regex never matched and FEEDBACK-RETRY ran anyway.
5. **Hollow-satisfier retry** (`:13336-13409`). It runs only when `selectedTemplateId` starts `satisfier:`.
6. **ALTERNATIVE-FRAMING**, once (`:13411-13505`).
7. **The floor** (`:13529`). Condition: `(walk.reached === false || walk.grounded === false || goalIsProseOverSource) && !goalIsEditIntent`.
   - It gets `seededOutputShapes`: the **original** inferred targets, not the re-frame's.
8. Return the walk, or route edit-intent goals, then the recommend loop (pinned-target refusals at `:14349`, the no-producer return at `:14337`).

**Cost of the ordering.**
- Time from dispatch start to floor entry, over 437 dispatches:
  - **median 94 s, p75 397 s, p90 1,013 s**;
  - p25 is 7 s, which is the REUSE-BEFORE-DERIVE floors.
- For a30a893c the floor started about 4 minutes after dispatch, after three full walks (walk, FEEDBACK-RETRY, re-frame), and its walls ran 25–35 s.

### 3.2 Measured: unreached dispatches with and without a floor attempt

**Method.**
- A dispatch start is a `goal-target inference {"goal_hash":…}` line. There are **870 starts**: 836 `/run-goal` and 34 `/resolve`.
- An unreached end is the per-dispatch `reached-command cache: EVICTED|RETAINED <hash> (… reach graded false …)` line.
- A floor attempt is `floor: ENTER … goalHash=<hash>` before that hash's next start.
- Dispatches were grouped per hash in journal order. This is exact for serial dispatches of one goal and approximate under same-hash concurrency.

| Population (node 1, 09-26 11:22 → 10-01) | Count |
|---|---|
| Starts | 870 |
| Unreached, with the graded-false marker | **437** |
| … with a floor attempt | **275** |
| … without a floor attempt | **162** |
| — of which edit-intent by reason text (`feature_compose` BUSY, `op_count`, early-edit-intent) | 152 |
| — of which "no template produces the inferred target shapes […]" at `:14337` | 10. **Checked:** `81fb8b90` is edit-intent (its own `EARLY EDIT-INTENT LANDED-PROBE … route-edit-81fb8b90` line). `ab027f8d` was not individually confirmed; its near-miss recall is an edit-intent goal. `ff34ece8` and `75aa8afc` inferred edit shapes. |
| Starts with no graded-false marker: a floor ran and reached, or the walk reached | 162 with a floor, 271 without |

**Result.** Every unreached non-edit dispatch in the window that produced a graded-false marker reached the floor. (The 271 no-marker, no-floor starts are assumed to be walk reaches and are not confirmed; see §8.) The only structural floor-skip is `!goalIsEditIntent`, and it is by design: edits go to `feature_compose`.

So for need-phrased goals the question is not "why didn't it fall to the floor". It is **"why did the floor fail"**:
- `tools=0/0` (§0);
- no search tool (§1);
- no evidence carried over from the walk (§4);
- and, from APPROACH, a judge with no clock.

**Three populations that never reach the floor and are not in the 870:**
- **SPEND-RATE REFUSED at handler entry:** 1,401 lines (222 on 09-27, 1,158 on 09-28, 3 on 09-29, 18 on 09-30). They are refused before inference and do not count as walks.
- **Pinned-target dispatches:** 746 `async /run-goal error` lines, appearing as identical pairs, so about 373 dispatches. All are `refusing pinned target development-vessel:scaffold-and-publish-vessel` (α 5.59 / β 7,823.77). They throw at `:14349` with no inference, no walk, no floor and no verdict.
- **The in-walk grounded investigation** (a.5, `index.ts:9520-9560`). It calls the same `runGroundedToolLoop` with `UNIVERSAL_READ_TOOLS`.
  - There are 1,390 `floor: walkBudget` lines. Subtracting the 492 floor entries that reach the budget read (501 minus 9 `no_dispatch_url`) leaves **about 898 in-walk loop runs**.
  - **0** of them logged `via GROUNDED tool-enabled investigation`. The positive control for the address: `VESSEL-RESOLVE SATISFIER produced` tap lines from the same function are captured throughout.
  - The reason is that this caller still requires `inv.groundedOk >= 1` (`:9552`), which is structurally 0 (§0). `559a55d` (07-27) removed exactly this gate at the floor call site and missed this sibling, so about 898 tool-enabled dispatches were discarded by construction.
  - It is also gated on the env var `LLM_VESSEL_ENDPOINT` (`:9520`; set in the unit env, so live, but a law-1 gate of the same form `559a55d` removed one call site over).

**Floor reach in the window**, from the per-run verdict lines:
- **110 of 439** verdicts reached (25.1%).
- Split by entry path (approximate under concurrency): REUSE-BEFORE-DERIVE floors **44/102**; post-walk floors **66/337**.
- REALIGNMENT's 161/1,276 (12.6%) used a longer retention on 09-29. The windows differ, so no movement is claimed.

**Positive control:** the floor did reach in this window, for example `universal ReAct fallback REACHED goal` 110 times. Its absence for a30a893c is therefore not an address fault.

---

## 4. Q4: target inference as a hint, not a gate

### 4.1 What the floor receives from inference today

- **`targetShapes`** = `seededOutputShapes`, the original inference. Its uses:
  - Write-suffix shapes become tools (§1); everything else is dropped from the tool list.
  - **On reach, the targets themselves are recorded as produced.**
    - `produced = [...targetShapes, ...calledWriteShapes]` (`:5428`) is what `verifyGoalReached` is told was produced.
    - The persisted tag is `completion_shapes:${targetShapes}` (`:5565`).
    - `recordGoalPath(…, uf.completionShapes, seededOutputShapes)` follows (`:13547`).
  - So a floor reach for a30a893c would have recorded `web_search, llm_completion, obsidian:write_note` as completed, though none was resolved by the floor. **The guessed target becomes learned evidence.**
  - That feeds `goal_execution_paths` and the ribosome. Through `/deliverable-shapes`, whose `ev > 0` gate admits everything (APPROACH §0.5), it can come back as inference vocabulary.
  - This is inference acting as a gate *after the fact*: it decides what the run is credited with.
- **The prompt** gets only `writeLine`. Non-write targets are not mentioned, so a target never acts as a *soft preference*. It is either a tool, or invisible.
- **The re-frame's alternative** is never passed to the floor (`:13531` uses `seededOutputShapes`).

### 4.2 Prior art on inference-as-router (what happened last time)

| Attempt | What it did | What happened |
|---|---|---|
| `f85a6d5` (06-25/30, "Lever 4") | LLM classifier from goal to target shapes | Declared "NL goals REACH end-to-end"; 07-02 dev goals were misrouted to maintenance ticks (dossier row). |
| `43247db` (07-23) | Inference SPECIAL RULE that `shellResult` is the universal executor, plus a deterministic `["shellResult"]` safety net; the client-side ReAct loop with a `groundedOk>0` gate | The commit's premise was "dev-vessel's dispatch returns tool_calls with NO text". llm-resolver has run its own tool loop since the 06-15 split (`5006825`/`386df99` contain `dispatchTool`), so the client-side loop had **0 live firings** (dossier 07-23). |
| `6cba611` (07-23) | Extracted the shared loop for the investigation fallback | That is the a.5 caller still gated on `groundedOk >= 1` (§3.2). |
| `559a55d` (07-27) | Removed the `LLM_VESSEL_ENDPOINT` gate and the `groundedOk===0 ⇒ null` gate at the floor; "trust the agentic wrapper" | Revived the floor, but made `tools=0/0` permanent and accepted. The sibling at `:9552` was missed. |
| `7721fe8` (07-28) | Deterministic prose route for question goals, "not `obsidian:write_note`" | A per-family regex route. The same terminal still wins for a30a893c two months later, because it now arrives through `/deliverable-shapes`. |
| `6082c2e` (07-31) | B2: union learned deliverable shapes into the inference vocabulary; B3: rank-0 cold scaffolds; B4: forward target-producer merge | B2 is the vocabulary path that admits `obsidian:write_note` today (APPROACH §0.5). B4 is the only forward-producer logic in the walk. |
| Routing-rule pile in `goal-target-inference.ts` | 24 autonomous commits (class `goal-walk-floor.json`, attempt "Target inference inverted guard…", `1f24ad1` … `e9ee9b4`); deterministic routes at `goal-target-inference.ts:259/280/288/337/372/505/550/854` | Class `goal-vocabulary-regex`: 6 recurrences; "each instance patched locally, class never retired". The web-search route at `:280` is dead for this goal (APPROACH: 0/887 inferences chose `web_search` via it). |

### 4.3 What "hint, not gate" means concretely

Each item is checkable. This specifies; it does not implement.

1. **Ceiling first, and only on evidence.** `recommendReachingPath` + REUSE-BEFORE-DERIVE already exist (`:13197-13255`). Keep them.
   - A learned producer of the inferred terminal with a positive earned posterior runs as the ceiling.
   - Otherwise the target is *not* a commitment.
   - The posterior check on the backward-chain path (APPROACH step 4) is the gate that stops a dead learned terminal (Beta(1, 63.2)) passing as "learned".
2. **Floor, forward, with targets as a soft preference.**
   - The tool offer is the shapes whose producers are live and whose description and schema are known (§1). It is not the write-suffix subset of the targets.
   - Inferred targets are named in the prompt as "likely useful".
   - Inferred targets *order* the offer; they never filter it.
3. **Credit only what was resolved.**
   - `completion_shapes` and `produced` on a floor run equal the shapes actually resolved by tool calls the floor observed.
   - They are never `targetShapes`.
   - This depends on §0: until the tool calls come back, the floor has no resolved set to report.
4. **The original targets go to the route-around record (§5)** as `inferred_targets`, next to the shapes actually resolved. The gap between the two is the learning signal.

---

## 5. Q5: where the §2.0b route-around record is emitted

**Decision site:** `runGoalWithRecoveryInner`, `index.ts:13529-13553`, the `if ((walk.reached === false || walk.grounded === false || goalIsProseOverSource) && !goalIsEditIntent)` branch. This is the one place where "the walk failed, so take the floor" is decided.

There is a second, distinct case at `:13244`: the REUSE-BEFORE-DERIVE floor. That one is *not* a route-around, because the floor is the learned pathway. It should be recorded with `kind: "floor_as_pathway"` so the counter can tell the two apart.

**What the record needs, and what the site lacks today:**

| Field | Available at the site? |
|---|---|
| `need_signature` | **No.** Track 3 P3 says to key by need, not by invented shape name. The nearest existing key is `goalClassTokenOf` (`:4244`), whose regex gives `what-happening` style tokens. That is too coarse, and too regex-like for the goal-vocabulary-regex class, so the signature is an open design item and not specified here. |
| `missing_producer` (the shapes the walk could not produce, and why) | **No.** `walk.goalReachReason` carries the *judge's* prose, and the structural "no pick — missing shapes [obsidian:write_note]" lives only in the walk log. The walk must return `missingTargets` and a termination class as structured fields. |
| `failed_producers` (picks that ran and failed, with deterministic reasons such as `Resolver 'obsidian:write_note' is not registered`) | Partly. `walk.selectedTemplateId` names only the *last* pick. The engine's "not registered" line is never captured as data (track 3 §2.2 item 5). |
| `inferred_targets`, `reframe_targets` | Yes: `seededOutputShapes`, `goalTargetDecision.alternatives` |
| `route_taken` = `universal-tool-fallback`, `floor_exec_id` | Yes, after the call: `floorExecId` is built inside the floor and should be returned. |
| `outcome` + **the floor's own reason** | Partly. `uf?.reached` is available. The floor's reason is not: an unreached floor returns `null` or an unreached result, and its reason ("all API calls failed due to authentication") lands only in the trace. `rememberGoalFailure` stores the walk's three verdicts. The floor's reason never reaches failure memory, and the structural reasons are dropped by regex (`:4255`). Related open gap: `compose-floors-only-console-log-their-reason-so-failure-memory-stores-no-detail`. |
| `dispatch_id` | Yes (`opts.variables.dispatch_id`). It is also missing from the floor trace (§0) and belongs on both. |
| `tools_resolved` | Not available until §0 is fixed. |

The record is a shaped impulse in the pool, with provenance (law 1).
- The counter, the threshold shape and the encapsulation-goal generator are the §2.0b generator: (b), in a non-excluded vessel.
- The emitter is (a), because goal-host `index.ts` is in `autonomyScope.excluded_paths`.

---

## 6. Prior art: the seven retracted "floor fixed" declarations (REALIGNMENT §2.0b, §6.2)

These are tabulated with evidence in `dossiers/goal-walk-floor.md` (timeline rows). They are cited here, not re-derived.

| Date | Declaration | Retraction |
|---|---|---|
| 05-02..03 | minibob vs Claude Code, "9/10 at ≤1.5x LLM calls": "ReAct parity" | It measured LLM-call parity, not outcomes. minibob was removed 05-24, and no parity measurement has existed since. |
| 06-25/30 | Lever 4 inference (`f85a6d5`): "NL goals REACH end-to-end" | 07-02 dev goals misrouted to ticks; 07-13 "no producer" for `substrateGap_write`. |
| 07-30 | Deterministic templating 7 → 14/14 | Hand-templated families only. Two-op reach is 1/8; the 09-19 generality round got R 3/7. |
| 09-11 | "Ladder reached 7/7" | The same day it was shown to measure self-health, not reach (8.6%/24h). |
| 09-12 | "Five substrate-authored repairs, reach 22.6%" | 09-13: operator-contaminated baselines. Autonomous reach was 0.9–2.6%. |
| 09-16 | "76 resolvers ~91% wired: ReAct floor met" | 09-18 the floor was dark on spokes; 09-22 the resolve-URL joiner killed `llm_completion`, `web_search` and `shellResult`. |
| 09-25 11:02 | "Best bucket 51%" | `8c31cdb` broke routing; the reach definitions were not comparable. |

**Floor-specific pairs relevant to this track:**
- `43247db`/`6cba611` (07-23) built a client-side loop that never fired. `559a55d` (07-27) revived the floor by trusting the wrapper, which made `tools=0/0` permanent, and missed the sibling at `:9552`.
- The 09-28 08:31 check-in (`beb19924`) found the floor broken by invalid-URL tool failures. The 09:30 check-in (`0863e1f8`) got the system to author 9 of 10 of its fix, and the tenth was blocked by a duplicate anchor.
- The 09-29 "did not engage" claim was contradicted by the journal. Today's "never ran on 10-01" repeats it (§0).
- `minted-copy-of-the-floor-shadows-the-floor` (memory-8 N69). The ribosome minted `learned-universal-tool-fallback` at 3/32. By 09-29 no such row exists (chunk-27 #1). A floor that becomes a walk step must not be re-minted as a single opaque activity. The extracted unit is the chain of `satisfier:<shape>` steps with edges (composition-crystallization root cause: "floor persists compositionChain []; ribosome mints nodes not edges").

---

## 7. Proposals

Each item below gives the seam, gate, builder, verification, and whether it is new or already in REALIGNMENT/APPROACH. No item widens addressability before §9.0, except where marked.

**P1. Surface the floor's tool calls (no new organ; supplies the falsifier for an open gap).**
- **Seam:** development-vessel `src/resolvers/llm-completion-dispatch.ts:451-472`. Read `rawBody.tool_calls` when `content` is a string, and return the text *and* the executed records.
- **Then:** goal-host `runGroundedToolLoop` (`:5228`) folds the executed records into `executed`/`observations`.
- **Gate (falsifier for gap `floor-tools-counter-reads-zero-…`):**
  - A persisted floor trace whose `metadata.final_text` narrates a command or HTTP call has non-empty `tasks[]`.
  - **Must-fail today:** 439/439, e.g. `universal-tool-fallback-a30a893c-1790847374795`.
  - **Positive control:** after the change, a floor run on a file-read goal shows `tools ≥ 1/1`.
- **Builder:** (b) for the dev-vessel half, if it is outside `excluded_paths` (verify before dispatch). (a) for the goal-host half.
- **Status:** a REALIGNMENT §1 / §7 step 8 positive-control item. The gap exists; the falsifier is new.

**P2. The same gate fix at the sibling call site (a).**
- **Seam:** `index.ts:9552`. Accept `inv.finalText` under the same conditions `559a55d` set for the floor, or, after P1, a real `groundedOk`.
- **Gate:**
  - **Positive:** the count of `via GROUNDED tool-enabled investigation` is above 0 per day.
  - **Must-fail:** a run whose loop produced no text still yields nothing.
  - Remove the `LLM_VESSEL_ENDPOINT` condition (law 1, as `559a55d` did one site over).
- **Status:** new, a sibling of `559a55d`. About 898 runs in the window were discarded.

**P3. Floor credit = shapes resolved, not shapes requested (a).**
- **Seam:** `universalToolFallback` `:5428` (`produced`) and `:5565` (the `completion_shapes` tag).
- **Gate:**
  - **Must-fail:** a floor reach that called no `web_search` must not tag `web_search`.
  - **Positive:** a floor reach that called `memoryNote_write` tags it.
- **Order:** depends on P1.
- **Status:** new for the floor. The same family as APPROACH step 3, "completion_shapes chosen in code" (§7.4 there).

**P4. Floor acts become walk steps (a; the Rank 0 core).**
- **Seam:** route each floor tool execution through the satisfier step block (`index.ts:10110-10245`): a persisted `walk-satisfier-N` trace, `addToPool`, `ledgerStep`, `recordStep`. The floor run's own trace then carries `composition_chain` = those ids and `dispatch_id`.
- **Gate:**
  - A floor run with k observed tool calls yields k `satisfier:<shape>` traces and k pool impulses linked to the floor trace.
  - **Must-fail today:** `composition_chain: null`.
  - **Downstream check:** ribosome extraction of a reached floor run yields a template with ≥ 2 tasks and edges, not a single `universal-tool-fallback` node.
- **Status:** REALIGNMENT §2.0b (output chaining, route-around) and the composition-crystallization root cause. The block reused is existing.
- **Offering registry shapes as tools is held behind §9.0 (stated here, not as a footnote).**
  - `ufResolveUrl` takes the first non-libp2p row with no locality check.
  - `llm_completion_dispatch` already resolves to `host.containers.internal:18090`/`26090`.
  - Widening the offer is an addressability widening.
  - Until §9.0, P4 applies to the current 5 + write tools only. Adding `web_search` alone is the one-shape exception the user decides (APPROACH decision 2, the schema seam).

**P5. The route-around record at `:13529` (a), with two structured fields the walk must return.**
- **Fields:** `missingTargets` plus the termination class, and the deterministic failed-producer reasons.
- **Also:** the floor's own reason goes into failure memory, without the structural-reason regex drop at `:4255` for this record.
- **Gate:**
  - **Positive:** a30a893c's next unreached dispatch emits one record with `missing_producer: [obsidian:write_note]`, `failed_producers` naming "not registered", and `route_taken: universal-tool-fallback`.
  - **Must-fail:** an edit-intent dispatch emits none, and a REUSE floor emits `kind: floor_as_pathway`.
- **Status:** REALIGNMENT §2.0b. The keying by need signature is APPROACH §7.2(ii) / track 3 P3; the signature itself is open.

**P6. Pass the walk's evidence to the floor (a).**
- The floor starts from an empty prompt context although the pool holds the walk's `web_search` result (5bef2e86).
- **Seam:** the call at `:13531`. Pass the successful-step pool impulses (with the provenance filter of APPROACH step 2, T2 P4) as observations, so the floor begins where the walk stopped.
- **Gate:**
  - **Positive:** a floor run after a walk whose `web_search` satisfier succeeded shows that result in its observations.
  - **Must-fail:** outputs of failed steps are absent.
- **Status:** an extension of APPROACH step 2, "a retry seeds the previous attempt's successful intermediates". New only in naming the floor as a consumer.

**Detector (law 6):** one §2.1 row. Count the floor runs whose `final_text` narrates a tool call and whose `tasks[]` is empty. It must be 0.
- Today it is 439.
- It would have fired on 07-27, the day `559a55d` accepted `tools=0/0`.

---

## 8. Limits of this report

- Node 1 only. Node 2's journal was not read.
- The per-hash dispatch grouping is approximate under same-hash concurrency. The REUSE/post-walk split attributes a floor entry to the most recent REUSE line.
- The dev-vessel drop mechanism (§0) was read in source and corroborated by the open gap and the `final_text` content. It was not executed.
- `ab027f8d`'s edit-intent status was inferred, not confirmed.
- Every verification in §7 is specified, not run.
- The 271 starts with no graded-false marker and no floor attempt are not confirmed as reaches. An ungraded unreached dispatch (a 0-step walk, or one that threw mid-walk) would also show no marker.
