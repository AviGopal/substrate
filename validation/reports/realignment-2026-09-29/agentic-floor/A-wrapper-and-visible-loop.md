# Track A: the agentic wrapper, and a floor loop goal-host can see

2026-10-01. Read-only. Nothing was dispatched, written, restarted or committed to produce this report. Sources:
- Live source in `substrate-live` under `/vessels/<vessel>/src`. goal-host is byte-identical to `origin/dev` `76bb373`.
- Journals. All four units begin **2026-09-26T11:22Z**.
- The goal-host dispatch store `/workspace/goal-host-dispatches.json`, read with `cat`. It holds 2,001 records, from 09-28T03:14Z.
- The `execution` table (SurrealDB, read-only `SELECT`).
- The gap store (jq filters).
- git history on `origin/dev` of goal-host, development-vessel, llm-resolver and ias-executor.

REALIGNMENT is read from `origin/dev`.

---

## 0. Answers in one screen

1. **The tool loop runs inside llm-resolver, and the wrapper throws away its transcript.**
   - The floor sends `tools` to development-vessel `llm_completion_dispatch`. The wrapper forwards them to llm-resolver, which runs a native tool-use loop of up to 20 turns, executes each tool itself and returns the executed calls as top-level `tool_calls`.
   - The wrapper reads tool calls only from inside `content`. `content` is a string, so it returns `llmTextCompletion` without the transcript.
   - goal-host's `tools=X/Y` counter is therefore **structurally** 0/0. Nothing anywhere records which tool ran, with what arguments, on which producer.
2. **No one chose "the wrapper over client-side".**
   - `43247db`/`6cba611` (07-23) built a *client-side* executing loop. It rested on a wrapper change, `22c66601` (07-15, substrate-authored), that read a field llm-resolver never sends, so the client loop never executed a tool.
   - `559a55d` (07-27) found the floor dead. It verified that the wrapper grounds on its own, and relaxed the grounding gate to trust the wrapper's text.
   - "Would re-kill that path" (`8a85cfa`, 08-15; `index.ts:5476-5479`) means: tightening `groundedOk > 0 || finalText` would bring back the pre-07-27 gate that discarded every grounded wrapper answer.
3. **Floor journal, 09-26T11:22 → 10-01T16:11:**
   - 501 `floor: ENTER`, 439 verdicts, **110 reached (25.1% of verdicts)**.
   - **439/439 `tools=0/0`** and 439/439 `groundedOk=0`.
   - Trace store: 1,824/1,824 floor rows have `tools_total=0`.
   - **Positive control found** (§3.3): a 09-30 floor run whose internal loop ran 4 real shell commands, including a file write that is still on disk. It persisted `tools=0/0`. The instrument is the finding. This answers REALIGNMENT §1 / §7 step 8 (R1-15).
4. **The date was not located. It is narrowed to one asymmetry.**
   - Template callers that omit `tools` get `DEFAULT_LLM_TOOLS`, which include `shellResult`.
   - The `llm_completion` satisfier posts tool-less.
   - No date text is injected anywhere on the dispatch path (§4 lists what was ruled out). The observation that would settle it is the same fix as answer 1.
5. **Options** (§6, after prior art in §5):
   - (i) Surface the executed transcript: cheap, §9.0-safe, visibility only.
   - (ii) Finish `43247db`: the client loop exists, but needs a "return pending tool calls" mode.
   - (iii) A per-call callback from llm-resolver's loop into goal-host.
   - Recommended order: (i) now as the instrument, then (ii) as the step-is-a-walk-step loop. (iii) is held by §9.0.

---

## 1. How `llm_completion_dispatch` runs its tool loop (Q1)

### 1.1 The call chain (live source)

| Hop | What happens | file:line |
|---|---|---|
| goal-host floor | `runGroundedToolLoop` resolves `llm_completion_dispatch` through discovery (`ufResolveUrl`). It POSTs `{type:"llm_completion_dispatch", prompt, max_tokens:4096, tools, caller:"goal-host:floor_tool_loop", execution_id, dispatch_id}`. | goal-host `index.ts:5139`, `:5202` |
| | The tools are a fixed list: `UNIVERSAL_READ_TOOLS` (`source_code`, `fs_read`, `codeSearchResult`, `shellResult`, `substrateGap`) plus `*_write` shapes taken from the guessed targets. **`web_search` is not offered.** The prompt tells the model to `curl` through `shellResult`. | `index.ts:4565-4571`, `:5389-5398` |
| development-vessel wrapper | Finds llm-resolver by `vesselCapability` lookup (`llmCompletion`, then `llm_completion`). It forwards `tools`. **When the pointer has no `tools` field it attaches `DEFAULT_LLM_TOOLS`** (`source_code`, `fs_read`, `codeSearchResult`, `shellResult`); `tools: []` opts out. It forwards `execution_id` and `dispatch_id` only when the pointer carries them. | `llm-completion-dispatch.ts:36-87`, `:101-166`, `:211-238` |
| llm-resolver | When `tools` is non-empty it enters the tool-use loop (Anthropic `:738-819`, OpenAI-wire `:869-962`). `maxIter = LLM_MAX_TOOL_ITERATIONS ?? 20`, capped at 30; the variable is unset in `/etc/substrate/env`, so 20. Every turn re-sends the whole message history. | `llm-resolver index.ts:474-476`, `:744`, `:875` |
| tool execution (inside llm-resolver) | `dispatchTool` refuses tools that were not offered (`tool-dispatch.ts:24-26`) and fixes `type` to the tool name. It stamps the dispatch `execution_id` **only if the request carried one** (`withDispatchExecutionId`, `tool-dispatch.ts:35-39`). It POSTs `{impulse:{pointer}}` to a URL from `resolveToolEndpoint`. | `index.ts:514-552` |
| producer choice | `resolveToolEndpoint` takes discovery `vesselCapability` → **`vessels[0]`**, and caches it **forever** per tool name. It falls back to development-vessel `:8090/v2/impulses/resolve`. There is no Thompson pick, no health check and no locality filter. | `index.ts:478-511` |
| return | `{resolved, shape:"llmCompletion", content: finalText (string), tool_calls: ToolCallTraceEntry[] (already executed: iteration, tool_name, tool_input, tool_output, duration_ms), iterations, usage}` | `index.ts:584-590`, `:804`, `:810-818`, `:946`, `:956-962` |
| wrapper unwrap | `_c = rawBody.content`. Tool calls are read only from `_c[0].tool_calls` or `_c.tool_calls`. A string `_c` yields `undefined`, so the wrapper returns `{shape:"llmTextCompletion", body:{text, model, usage}}`. **The top-level `tool_calls` transcript is dropped here.** | `llm-completion-dispatch.ts:453-492` |
| goal-host reads | `toolCalls = j?.body?.tool_calls ?? j?.tool_calls ?? []` is always `[]`, so the turn counts as a final answer and the loop ends. | goal-host `index.ts:5228`, `:5289-5293` |

### 1.2 Consequences

- **The `llmToolCalls` branch is unreachable** with the live llm-resolver (`llm-completion-dispatch.ts:471-473`). Both provider paths return `content` as a string.
  - The federated envelope (`{shape, value, …}` under `content`) was not checked for a `tool_calls` member, so that case is **unverified**.
- **If it ever did fire, goal-host would execute every tool twice.**
  - `nameOf`/`argsOf` already accept `tool_name`/`tool_input` (`index.ts:5175-5180`), which are exactly llm-resolver's executed-record field names.
  - The open gap (§5) states this caution correctly.
- **The outer loop is inert on the normal path.**
  - The wrapper answers in one turn, so `MAX_ITERS`/`walkBudget` (`:5150-5172`, shaped to `iters=8` on this node), the per-turn call cap, `(tool,args)` dedup and the 12,000-char observation slice govern nothing.
  - Outer iterations happen only after a TIMEOUT (57 at iter 0, 9 at iter 1, 3 at iter 2 in the journal window) or a 5xx (41 lines). The window is that of §3.
  - The real loop limit is llm-resolver's 20 turns. The 1.58M-input-token floor call in gap `goal-host-floor-tool-loop-input-is-unbounded-…` is that inner loop's re-send.
- **Nothing logs or traces a tool call at any layer.**
  - llm-resolver's loop has no log line. Its `ToolResultBudget` bounds only the copy that goes back to the model; the transcript keeps raw `r.result` (`:804`, `:946`).
  - local-tools logs a command **only when `execution_id` is absent** (`local-tools index.ts:216-217`).
  - The trace store accepts `tasks[].tool_calls` (activity-api `routes/execution-traces.ts:239-267`), but no writer fills it. The bridge trace below shows `"tool_calls":[]` on every task.
  - The floor persists `tasks: executed.map(…)` with `outputShapes: []`, `inputImpulseIds: []`, `compositionChain: []` (`index.ts:5531-5547`). Its `completion_shapes` are the *requested* targets (`:5565`).
- **Attribution differs by caller.**
  - The floor forwards its dispatch id, so its tool calls carry `execution_id`. That makes them *invisible* in the local-tools log, and nothing else records them.
  - Template callers do not. For example, `auto-bridge-obsidian:write_note`'s `synthesize_content` task is proxied by goal-host `buildProxyResolver` (`index.ts:15087-15125`) with `{...variables, ...config}`. Their tool calls reach producers unattributed.
- **The floor's own client-side executions are not counted either.** The recipe/investigation seeds run `shellResult` through `ufExecuteTool` (93 `SEEDED` lines in the window) outside `executed[]`.
- **§9.0 hazard, independent of visibility.**
  - `resolveToolEndpoint` takes `vessels[0]` with no locality filter.
  - goal-host's `ufResolveUrl` prefers a local HTTP row but falls back to a libp2p row (`:4588-4598`).
  - Both routers can send a tool call to a peer producer.

---

## 2. Why the wrapper path, and what "would re-kill that path" means (Q2)

| When | Commit | What moved | Measurement behind it | Gained | Lost |
|---|---|---|---|---|---|
| ≤ 06-15 | llm-resolver initial split `386df99` | The tool loop already lives in llm-resolver (`tool_dispatch_endpoint`, `ToolCallTraceEntry`). | — | — | — |
| 07-10/11 | dev-vessel `ff3d5d58`, llm-resolver `1333e3f` (substrate-authored) | `DEFAULT_LLM_TOOLS` renamed to real advertised shapes. `dispatchTool` routes each call by discovery. | Old names (`code_search`, `shell`) 404'd, and the content LLM "asked for the files". | The internal loop can actually execute tools. | Producer choice is fixed at `vessels[0]`. |
| 07-14 | dev-vessel `8f8cd175` | `tools: []` opt-out. An absent field keeps the defaults ("walk satisfier fallbacks rely on them"). | ~500 schema tokens per request. | Cheaper single-shot calls on request. | **Every caller that omits `tools` silently gets a 20-turn agentic loop.** Root of the 09-29 spend gap (§5). |
| 07-15 | dev-vessel `22c66601` (substrate-authored, mitosis) | The wrapper reads `content[0].text` / `content[0].tool_calls` and returns `llmToolCalls`. String `content` broke and was patched 39 min later (`ab8d61c6`). | None recorded. | — | Introduced the branch that cannot match llm-resolver's response. **This is the "surface tool calls" attempt; it had no positive control.** |
| 07-23 01:24 | goal-host `43247db` | Built the **client-side** executing loop: allowlist, caps, dedup, wall clock, `groundedOk` reads only, and a grounding gate `groundedOk===0 ⇒ null`. | "count/date/inspect goals reaching **0/3 grounded**"; "dev-vessel's dispatch returns tool_calls with NO text". | On paper: every call executed and counted by goal-host, plus `commandEvidence` for the judge. | In practice: no tool call ever reached it, so the gate nulled every floor answer. |
| 07-23 02:51 | goal-host `6cba611` | Extracted the loop as `runGroundedToolLoop`; the a.5 investigation fallback shares it. | ".rs count = 6 vs truth 0" fabrication. | One loop for both callers. | Same dead tool branch, in two places now. |
| 07-27 | goal-host `559a55d` | **The loop effectively moves to the wrapper.** The env gate (`LLM_VESSEL_ENDPOINT`) was removed, and the gate became "trust the wrapper's substantive text; fail only when nothing came back". | Live: an unguessable version → exact `1.20.9`; a non-existent file → "does not exist". | The floor reaches again. | `groundedOk`, `executed[]` and `commandEvidence` are permanently empty for the floor. Grounding is now asserted from text, not counted. |
| 08-15 | goal-host `8a85cfa` (+ `23276d5`) | Kept the `||`, and prepended "ZERO tools were executed…" to the judge digest when `executed.length===0`. `23276d5` refuses a narrated tool transcript. | 3 fabricated reaches: eBay price; Earth–Mars 16 days stale; Earth–Io 5.204 AU vs a true 6.2734. COMPOSITIONALITY_STATE §15.22 probes: wrapper `wc -l CLAUDE.md` = 361 (true 361); the eBay question asked directly got an honest "could not fetch". | Fabrications lose authority. | **The preamble is wrong on every floor run**: it says zero tools ran when the wrapper may have run many (§3.3). The judge is told something false about grounded answers too. |
| 08-17 | goal-host `825f773` | 5xx becomes an observation, not a break. | 15 aborts in 3 h at iter 0. | — | Only matters on the outer loop, which rarely iterates (§1.2). |
| 09-29/30 | gaps (§5); llm-resolver `2281b38`, `cadf494`, `fa9ca77` | Per-dispatch input budget, bounded tool results, an offered-only allowlist, and the dispatch `execution_id` always winning on tool calls. | 470K input tokens per call (09-29); 1.58M per floor call (09-30). | The inner loop is bounded and attributable when an id is present. | Still invisible to goal-host and the trace. |

**"Would re-kill that path"** (`index.ts:5476-5479`, written in `8a85cfa`) refers to `559a55d`'s revival.
- Before 07-27 the floor's reach required `groundedOk > 0`.
- The wrapper's internal loop always yields `groundedOk === 0`, so every grounded wrapper answer was discarded. The floor was "dead".
- `8a85cfa` declined to tighten the boolean for that reason, and fixed the judge's input instead.

So the wrapper "won" by accommodation, after a client-side design that was never exercised. Nobody weighed the trade-off.

**What each move lost, net:**
- The client-side design (07-23) had per-call visibility, counting, a command↔intent check and a grounding gate. It executed nothing.
- The wrapper design (07-27 on) reaches. It has no per-call visibility, no producer selection, no attribution for template callers, and untraced side effects. Its cost is unbounded until 09-30. The judge is told "zero tools" on grounded runs.

---

## 3. Floor measurements (Q3)

### 3.1 Totals

**Window: goal-host journal, 09-26T11:31 → 10-01T16:11 (retention begins 09-26T11:22).**

| Line | Count |
|---|---|
| `floor: ENTER universalToolFallback` | 501 |
| `floor: verdict` | 439: 110 `reached=true`, 329 `reached=false`, 0 `verdictNull=true` |
| `groundedOk` on verdict lines | **0 in 439/439** |
| `floor: persisted … tools=X/Y` | **`tools=0/0` in 439/439** (110 reached, 329 not) |
| `floor: exit=empty_loop` / `exit=no_dispatch_url` | 52 / 9 |
| `FABRICATED TOOL TRANSCRIPT` refusals | 2 |
| Runs with ≥1 client-side tool in `executed[]` | **0** |

- Floor reach in this window is 110/439 = 25.1% of verdicts.
- REALIGNMENT §1's 161/1,276 (09-29, journal from 09-25T14:35) came from a longer retention, so the two are not comparable.
- `walkBudget SHAPED` appears 1,371 times against 501 ENTERs, because the a.5 investigation also calls `runGroundedToolLoop` (`index.ts:9551`).

**Trace store (`execution`, `activity_id='universal-tool-fallback'`).**
- 1,824 rows, created 09-10 → 10-01, with rows on only 8 distinct days (reclaim gaps).
- `tools_total = 0` and `grounded_reads = 0` in **1,824/1,824**.
- Reached 304, not reached 1,520.

### 3.2 Split by author

**Window: 09-28T03:14 → 10-01T16:11.** That is where the dispatch store and the journal overlap.

**Method.** Floor `goalHash` values are joined to dispatch records by recomputing goal-host's `goalHashOf`.
- Note: it multiplies as a JS float (`hash * 16777619 >>> 0`), **not** `Math.imul`. Reproducing it with `Math.imul` joins nothing.
- Positive control: the computed hash for `5bef2e86` is `a30a893c`.
- Of 273 ENTERs in the window, 270 joined.

| Author (raw `operator` / `trigger`) | ENTER | verdicts | reached |
|---|---|---|---|
| **Human:** `human-surface`, `operator:claude-avi`, `claude-code-operator` | 55 | 36 | **1** |
| **Autonomous:** `gap-closing` (93/85/24), `gap-decompose` incl. mixed (31/28/19), `recovery\|gap-closing` (5/5/0), `rhythm-conductor-drain` (43/41/1), `learning-liveness-probe` and `operator:latency-probe` (2/2/0) | 174 | 161 | 44 |
| **Unattributable:** `trigger:run-goal` is the attribution floor (goal-host `index.ts:16361-16363`); also `run-goal\|recovery`, `null`, and 3 unjoined | 44 | 39 | 9 |
| **Total** | 273 | 236 | 54 |

- `rhythm-conductor-drain`, `learning-liveness-probe` and `latency-probe` sit in the `operator` field but are synthetic, so they are counted as autonomous.
- Human-authored floor runs reached **1 of 36** verdicts. Autonomous gap-decompose runs reached 19/28.
- This matches APPROACH §7.5's request to split floor reach by goal kind.

### 3.3 Positive control: the instrument is the finding

The floor run `goalHash=27c1c600`, 2026-09-30, `/resolve` path, no dispatch id.

| Time | Source | Line |
|---|---|---|
| 01:47:03 | goal-host | `floor: ENTER … targetShapes=["goal_execution"]` |
| 01:47:04 | goal-host | `[uf] tool call WITHOUT dispatch id: tool=walkBudget`. This is the **only** `[uf]` line in the run, so goal-host's client path executed no `shellResult`. |
| 01:47:14, :21, :24, :26 | local-tools | 4 × `shell request WITHOUT execution_id … pointer keys=["type","command"]`: `curl -sSL "https://gist.githubusercontent.com/…/raw" > /work…`, then three more `curl`s against gist.github.com and api.github.com |
| 01:48:04 | goal-host | `floor: verdict … groundedOk=0 finalTextLen=426`, then `persisted … reached=false tools=0/0` |

- Trace row `universal-tool-fallback-27c1c600-1790732884784` has `metadata.final_text`: "The gist … returns **404** … user `ewitecki` also doesn't appear to exist (API returns 404) … The file was created at `/workspace/git/super-repo/GPT-5.md` but contains only the 404 error message (14 bytes)." It also has `tools_total: 0`.
- **The side effect is still there:** `/workspace/git/super-repo/GPT-5.md`, 14 bytes, mtime 09-30 01:47, in the substrate's super-repo clone. It is untraced and left untouched by this read-only run.
- The "write vs read" separation in `runGroundedToolLoop` is meaningless when `shellResult` can redirect output to a file.

**Co-occurrence across the window** (weaker evidence: a time window only, with concurrency possible):
- 24 of 500 paired floor runs ran without a dispatch id. Only those runs' internal shell calls can show up in the local-tools log.
- 8 of the 24 had ≥1 non-templated shell command inside the floor window.
- All 8 persisted `tools=0/0`.
- The other 476 carried a dispatch id. Their internal calls are recorded **nowhere**.

**What this answers:**
- The falsifier named by REALIGNMENT §7 step 8 / R1-15 and by gap `floor-tools-counter-reads-zero-…` is answered. Tools run, and the counter cannot see them.
- "The floor is not a tool-using ReAct loop" stays withdrawn.
- "Floor tool use is unmeasured, and the digest tells the judge 'ZERO tools were executed' on runs that executed tools" is now a fact.

---

## 4. Where the date enters the `llm_completion_dispatch` path (Q4)

### 4.1 The asymmetry that is established

- **The bridge path has tools.** The live `auto-bridge-obsidian:write_note` `synthesize_content` task config is `{type:"llm_completion_dispatch", model:"anthropic/claude-haiku-4-5-20251001", max_tokens:1500, prompt:"…GOAL:\n{{goal}}"}`, with **no `tools` field**. So the wrapper attaches `DEFAULT_LLM_TOOLS` (`llm-completion-dispatch.ts:221-223`), and llm-resolver runs an agentic loop with `shellResult`, `fs_read`, `source_code` and `codeSearchResult` available.
- **The satisfier path has none.** goal-host `rawResolve` posts tool-less `llm_completion` straight to llm-resolver (`index.ts:8174-8193`).
- **One positive on the bridge path.** `exec_9g3u201s` (10-01T16:00:58, a30a893c's third dispatch) bound its own synth output (`dev:llm_completion_dispatch_b5qzfbgj`) into `produce`. The content begins "Today is **October 1, 2026**". The synth task took 21.8 s.
- **Six negatives on the bridge path.** The other 6 bridge runs that day (08:56–16:03) produced placeholders (`{{current_date}}`, `[Current Date]`) or nothing.

### 4.2 Ruled out (each checked in the live source or data)

- **Date text in the prompt.** The template prompt is goal-only. The goal text carries no date.
- **The wrapper.** `llm-completion-dispatch.ts` has no `Date` use.
- **llm-resolver.** `Date`/`toISOString` appear only in gap and spend bookkeeping (`index.ts:346`, `:385`, `:1473`). There is no system-prompt injection.
- **The goal-host proxy pointer.** `buildResolvePointer` = `{...variables, ...config, type}` (`resolve-pointer.ts:10-18`). The trace's `input_state.variables` is `{}`.
- **goal-host's date blocks.** `temporalGrounding` (`index.ts:7730`, `:8304`) and `priorVerdictFeedback` (`:8186`) reach only arg extraction, the producer pick and the rawResolve `llm_completion` branch.
- **Live-search model arms.** The 14 arms in `/workspace/policies/llm-model-policy.json` include no perplexity/sonar/`:online` model.
- **A `shellResult` call to *this node's* local-tools without `execution_id` in 08:56–09:34 and 15:50–16:10.** Every logged command there is templated (`ROOT=…`), with no `date` and no news `curl`. Note: `date` matches 0 times in 10,979 such lines since 09-26.

### 4.3 Not ruled out

- `fs_read`, `source_code` and `codeSearchResult` calls. These are logged nowhere, and a file's content or mtime can carry the date.
- A tool row that resolved to a peer: `vessels[0]`, cached forever.
- A federated LLM arm whose loop ran tools on the hub. The wrapper falls back lazily to federated arms (`:396-435`).
- A tool call that carried an `execution_id`. None was found in code for the bridge path.
- The served model itself. The pinned Anthropic id has no Anthropic key on node 1 (gap `walks-feed-a-raw-execution-trace-dump-…`), so a fallback arm served it. Which one is unrecorded per call.

### 4.4 Conclusion and next step

- The dispatch path carries a **tool loop**. The satisfier path does not. No date text is injected on either path.
- The most likely source is a tool output read inside the bridge's loop. That is **not demonstrated**, because the transcript is dropped (§1.1).
- The discriminating observation is option (i) below: one bridge run with its transcript would answer this.
- Do not register a clock shape or add prompt text on this evidence. APPROACH §4 step 3 already says "investigate first", and `8a85cfa`/`2c26fcb` show that prompt-text date fixes do not hold.
- Corollary for APPROACH §3 ("the date appears on the dispatch path but not on the satisfier"): **the sibling difference is "tools vs no tools"**, not a date injection.

---

## 5. Prior art (before any proposal)

| Prior attempt | What was tried | What happened | Why it held or regressed |
|---|---|---|---|
| `22c66601` (07-15, substrate-authored) | Surface tool calls from the wrapper as `llmToolCalls`. | It read `content[0].tool_calls`, a field llm-resolver never populates. String content broke and was patched the same night (`ab8d61c6`). | No positive control. The branch has been dead for 2.5 months (§1.2). |
| `43247db` + `6cba611` (07-23) | Client-side executing ReAct loop in goal-host, with a grounding gate. | It never executed a tool. Combined with the env gate, the floor was dead until 07-27. | It was built on 22c66601's premise and never checked against a live response. |
| `559a55d` (07-27) | Trust the wrapper's internal loop and relax the gate. | The floor reaches (110/439 now). | It held because it *removed* a check. Visibility was never restored. |
| `8a85cfa`, `23276d5` (08-15) | Fix the judge's input rather than the boolean; refuse narrated transcripts. | Fabrications lost authority. | The "ZERO tools" preamble is factually wrong on grounded wrapper runs (§3.3). |
| `8ee6c66` (08-06) | Persist floor executions with a real id. | 1,824 rows exist. | `tasks`, `outputShapes` and `compositionChain` are all empty. The substrate's own detectors misread the rows: gaps `systematic-failure-universal-tool-fallback-zero` ("(no tasks) 0/0 tasks ok"), `phantom-success-universal-tool-fallback-…` ("task_count=0"). |
| Gap `floor-tools-counter-reads-zero-because-llm-resolver-runs-the-tool-loop-and-dev-vessel-drops-its-tool-calls` (open, human_reported 09-30, `edit_site` the wrapper, `falsifier:none`) | Same diagnosis as §1. It warns about double execution and names untraced tool calls (`698a00ed`, `ls` with no `execution_id`). | Open. | §3.3 supplies the positive control its falsifier lacked. **Extend this gap; do not mint a new one.** |
| Gaps `walks-feed-a-raw-execution-trace-dump-…` (09-29), `goal-host-floor-tool-loop-input-is-unbounded-…` (09-30) | Bound the inner-loop spend. | llm-resolver `2281b38` (per-dispatch budget, bounded results), `cadf494` (offered-only), `fa9ca77` (execution_id wins). | They held as bounds. They were not aimed at visibility. |
| Class composition-crystallization; gap `minted-copy-of-the-floor-shadows-the-floor` | Root cause recorded as "floor persists compositionChain []; ribosome mints nodes not edges". The ribosome minted `learned-universal-tool-fallback`. | chunk-27: that row no longer exists. | The edge-less mint follows from §1. There is nothing to extract edges *from*. |
| activity-api `routes/ribosome.ts:140-200`, `:355-400` | A tool-call → template extractor that reads `trace.tasks[].tool_calls`. | It is keyed to Claude-Code tool names (`read`/`grep`/`write`/`edit`/`bash`), not substrate shapes. Its liveness was not measured. | An existing reader to re-key, not a reason to mint a new one. |
| COMPOSITIONALITY_STATE §15.21–15.23 | The probes that justified trusting the wrapper. | Stated the wrapper is "genuinely agentic and grounded". | True, and still unobservable per run. |

---

## 6. Options for "every step visible as a shape transition" (Q5)

Common constraints for all options:
- **§9.0.** Making calls *visible* adds no address or writable seam. Widening the tool list to registry shapes does: both routers already resolve to peer or libp2p rows. Any widening waits for locality plus route auth.
- **Law 3.** Extend the open gap above and the existing trace fields (`tasks[].tool_calls`, `ToolCallTraceEntry`). Mint nothing.
- **Builders.** goal-host `index.ts` is (a). The development-vessel wrapper and llm-resolver are (b) candidates, **subject to the live `autonomyScope.excluded_paths` at dispatch**, which this read-only pass could not read without a POST. ias-executor is (b) under the same check.

### (i) The wrapper surfaces the executed transcript; goal-host turns it into pool impulses and trace tasks

**Seam.**
1. llm-resolver `resolveWithAnthropic`/`resolveWithOpenAI` (`:804`, `:946`):
   - add producer identity (the resolved tool URL or vessel id) to each `ToolCallTraceEntry`;
   - bound `tool_output` to an excerpt plus a lazy pointer, using the same `ToolResultBudget` limits.
2. dev-vessel `llm-completion-dispatch.ts:453-492`:
   - pass the top-level transcript through under a **new key** (e.g. `body.tool_transcript`), **never `tool_calls`**, because goal-host `:5228`/`:5175-5180` would re-execute it.
3. goal-host `runGroundedToolLoop`:
   - count transcript entries into `executed`/`groundedOk`/`commandEvidence`;
   - add each entry as an observation impulse with provenance (shape = tool name, producer, `dispatch_id`);
   - persist floor `tasks[]` with `tool_calls` and `outputShapes`.
4. Template callers: goal-host `buildProxyResolver` and ias-executor `vessel-resolver.ts:131-136` (which spreads `body.metadata` into impulse metadata) are the carriers. **First verify that the engine writes them to trace `tasks[].tool_calls`.**

**What breaks.**
- Response size: transcripts are large today (1.58M input tokens per floor call), so the bound is mandatory.
- The `8a85cfa` "ZERO tools" preamble flips to correct, so judge behaviour on floor runs changes. Treat this as one change (law 12).

**Cost.** About 3 small edits. No extra LLM calls.

**Resembles.** `22c66601` (wrong field, no control) → a positive control is required before declaring done.

**Limit.** This gives **observe after the fact, not act-time control.**
- Producer choice stays `vessels[0]`.
- Steps can't be retried, re-routed or stopped at a step by goal-host.
- It does not on its own meet design point (1), "act = resolve a shape, producer by Thompson".
- It does meet (2) provenance, (5) failure located at a step (a failed entry carries tool, args and error), and the input the ribosome needs for edges (4).

**Gate (deterministic).** Floor `tools_total` must equal the transcript length, and `groundedOk` must equal the count of ok non-write entries.

**Controls.**
- Must-fail today: a 01:47-style no-dispatch-id floor run shows N local-tools shell lines and `tools=0/0`.
- After the fix: the same run shows `tools=N/N`.
- Double-execution guard: local-tools shows exactly N commands for N entries, not 2N.
- Negative: a `tools: []` call yields an empty transcript.
- Date (§4): one bridge run shows which tool output carried the date.

**Status.** Already in REALIGNMENT? §1/§7 step 8 named only the *measurement*. The surfacing seam is the open gap's own fix direction. **Not new.**

### (ii) goal-host runs the loop: one LLM call per step returns pending tool calls; goal-host executes each as a walk step

**Seam.**
- A "return pending tool calls" mode in llm-resolver: a request flag that makes the loop return `tool_use` blocks without calling `dispatchTool`. This is needed because `max_tool_iterations: 1` still executes (`:795-807`).
- The wrapper passes pending calls through its existing `llmToolCalls` branch, reading the right field this time.
- goal-host's existing executing branch (`index.ts:5252-5290`) then becomes live as `43247db` designed it. Each call goes through `ufExecuteTool`. That is where a shape-resolve step, Thompson producer pick, pool impulse, route-around record and failure memory can attach, because goal-host owns the step.

**What breaks.**
- goal-host re-sends a flat prompt plus an observations string (`:5193-5195`), not the provider's native `tool_use`/`tool_result` protocol. Answer quality and prompt caching may drop.
- Latency: two hops per turn.
- `MAX_ITERS` (shaped 8) and the 210 s wall clock replace llm-resolver's 20 turns.
- Template callers keep the internal loop, so they still need (i).

**Risk: the 07-27 class.** If the pending-call shape is wrong again, the floor silently degrades to memory answers. So the switch is gated on a positive control (tools>0 on a goal that needs one read) **and** a reach-rate comparison against the (i)-instrumented baseline over the same goal set. One change only.

**Cost.** One flag in llm-resolver (b, subject to the scope check) and a wrapper field (b). goal-host wiring is (a): ~mostly dead code reactivated, plus pool and trace writes.

**Resembles.** `43247db`/`6cba611`, which built exactly this consumer and never ran it.

**This is the only option that makes a ReAct step a walk step** (design points 1, 2, 5). Widening its tool list to registry shapes with descriptions is held by §9.0.

### (iii) Other

**(iii-a) The loop stays in llm-resolver; each tool call is dispatched back through goal-host.**
- Mechanism: `tool_dispatch_endpoint` already exists per request (`:577`, `:742`, `:873`), but `dispatchTool` prefers discovery over it (`:479-511`). So llm-resolver would need "an explicit endpoint wins".
- Benefit: it keeps the native protocol and caching, and gives goal-host act-time sight and producer choice.
- Costs:
  - It needs a goal-host route that executes arbitrary shaped calls. That is the "new single-use REST endpoint" red flag, and a writable seam under §9.0 (route auth first).
  - A recursion guard through `withDispatchExecutionId` lineage (the 09-26 storm).
- Builder: (a) for the goal-host route, (b) for the llm-resolver change. **Held by §9.0.**

**(iii-b) Each producer traces its own executions.**
- This conflicts with the 10-01 standing rule: the trace store is for gradable executions, and routine calls become counters.
- It scatters provenance across vessels.
- Not recommended.

### Order (recommendation)

1. **(i) now, as the instrument.** It is §9.0-safe, extends the open gap, and settles §4. Supply the gap's falsifier from §3.3.
   - In the same goal-host change (a), set floor `completion_shapes` from executed shapes, not requested targets. That is APPROACH §7.4's in-code rule, applied to the floor.
2. **Then (ii)**, gated on the controls above. This turns the floor into walk steps whose chain the existing ribosome / `mintReachedTrace` can extract with edges. REALIGNMENT §2.0b's route-around emitter attaches at `ufExecuteTool` failures.
3. **Widen the tool list only after §9.0.**

**Not proposed:**
- a new ReAct vessel;
- a new transcript shape family beyond one field;
- a date shape, until (i) has answered §4.

---

## 7. Findings for the coordinator (not acted on)

- **An untraced write by the floor.** `/workspace/git/super-repo/GPT-5.md` (14 bytes, 09-30 01:47) sits in the substrate's super-repo clone, from floor run `27c1c600`. The "read tools" set can write through `shellResult`.
- **The judge is told "ZERO tools were executed" on floor runs where tools ran** (`index.ts:5482-5484`). Every one of the 439 verdicts in the window was graded with that preamble.
- **Floor reach is 1/36 for human-authored goals** against 44/161 for autonomous ones (09-28→10-01). This is supporting evidence for APPROACH §7.5's split.
- **Line drift.** REALIGNMENT §1 cites `index.ts:5394` for the counter. On `76bb373` it is `:5594`, and the wrapper comments are at `:5409-5419` and `:5476-5479`.
