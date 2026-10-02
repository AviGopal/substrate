# Agentic runner, track 4: the execution sequence end to end

2026-10-01/02. Read-only. No dispatches, no writes, no restarts and no edits outside this file. The only
POSTs were read-only resolves: `mcpTool` on concept-db and activity-api, `activity_search` on activity-api,
and discovery `vesselCapability` lookups. Two `SELECT count()` reads were made on SurrealDB.

**The question.** Where does an agentic runner sit relative to the walk, and how does one step flow?

**The answer in one paragraph.** Today the walk and the floor are two engines run in series. The walk is a
backward-chaining shape walk inside `runGoalAsPoolWalk`. The floor is a ReAct loop inside llm-resolver,
reached only after up to three full walks have failed. It has no pool and no tasks, and its tool list is
hand-written. The target is not a third engine. **The runner is the walk's forward mode.** When the backward
chain stalls, the same walk, with the same pool, picks its next step forward:
1. It builds a ranked offer of resolvers, activities and one search tool.
2. The LLM chooses from the offer.
3. The walk's existing step blocks execute the choice.
4. The result enters the pool with provenance.

The walk hands back to the backward chain or the ceiling as soon as a step puts a learned pathway in reach.
Almost every arrow of that loop already has an organ. The missing parts are mostly *joints*. The few genuinely
new items are listed in §7.

---

## 0. Sources, windows and corrections

- **Live goal-host source.** `/vessels/goal-host-vessel/src/index.ts` in `substrate-live`: 18,123 lines,
  mtime 2026-10-02 02:10 (local). The mirror head is `/workspace/git/vessels/goal-host-vessel` `a72918f`
  ("fix(containment): goal walks refuse fs write and commit shapes", 10-01 19:09 -0700).
  - Every `index.ts:N` below is a live number read in this session.
  - Agentic-floor track D read 18,114 lines, so its numbers drift by roughly +9 to +100. For example, the
    floor decision site is now `:13538`, not `:13529`; MINT-AS-YOU-GO is `:10691`, not `~10589`; the floor
    call is `:13540`.
  - The goal-host numbers in the prior-art sub-read (`:5202`, `:12094`, `:13133`, `:4467`) came from a
    local checkout, not live. They are **not** used. Only that read's doc and openspec line numbers are used;
    `git diff origin/dev -- docs openspec` is empty.
- **minibob.** `repos/deployment/vessels/minibob` at the submodule pointer `677f8ff` (2026-05-20). Later
  `main` commits removed the engine:
  - `67e3329`: delegate to goal-host over HTTP;
  - `e534a72`: −41,836 lines;
  - `814d215`: −38,194 lines.

  All three are dated 05-24.
- **REALIGNMENT** is read from `origin/dev` (§1, §2.0, §2.0b, §3.3–3.4, §9.0, §9.5).
- **Prior tracks are cited, not redone.** `agentic-floor/APPROACH.md` and A–E, and `output-shapes/APPROACH.md`
  and 1–5.
- **Numbers.** The live reads in this file are single 10-01/02 probes (n = 1 each) unless a row cites a
  track's windowed census.

**Correction to the brief's premise.** "minibob's GoalImproviser (`src/improviser.ts`) had the right
behaviours" is true of its *design*. It is not true of what minibob *ran* in its last three weeks.
- `8b918d2` (05-06) removed the last production call: `improviseUntilComplete` → `executeGoal`.
- At HEAD the only instantiation is `src/resolvers/improviser-resolver.ts:156`. That class is exported
  (`resolvers/index.ts:16`) and never constructed.
- What "improvise" meant at HEAD was the `improvise.json` template: one LLM task with a native tool loop
  (§3.2).

So the design the user names was already dead code when minibob was retired. The loss accounting never
noticed (§1.2).

---

## 1. Prior art (read first)

### 1.1 What the architecture docs specify — two layers that disagree

| Layer | Says | Where |
|---|---|---|
| **Old: "improvise with recording"** | "By allowing improvisation with recording, we enable the system to grow its own capabilities." Selection ends with `[improvise] fallback if nothing matches`. "Improvisation MUST be recorded." The trace has `trace_type:"improvisation"` and `steps[{tool,…}]`. The ribosome turns a successful improvisation into a template at α=1, β=0. | IMPULSE_ACTIVITY_FOUNDATION :35, :455, :631–633, :647, :651–681, :685–695 |
| | "Reserve Improvisation… record it"; "LLMs are one resolver type"; mint only as the exception, "the interposable selector preferring an existing producer over the improvise slot". | IAF :1048–1052, :1177–1183 |
| | A separate "Improvisation (LLM solves directly)" stage after Template Creation. | IMPULSE_STATE_SPACE_SPEC §4.5 :300–323 |
| | "Reserve improvisation = active complex growth at Beta(1,1)". | SUBSTRATE_AS_DEC :272 |
| **New: "no improvisation mode"** | "There is no improvisation mode. Every route is a walk tier." | sequences/README :313 |
| | "No separate improvisation mode." Bridge minting/gap filing, plus the floor, "a bounded ReAct-style loop over the tools discovery can reach"; "every step of the attempt lands in a trace". `improvise_solution` "should be read as retracted". | sequences/04 :120–131 |
| | "There is no if/else in the host between 'run a template' and 'improvise'." | sequences/01 :388 |
| | **"Nested dispatch is declared on the task, not offered to the model as a free-form tool."** | sequences/03 :259–261 |
| | The walk is backward chaining. Missing inputs become sub-targets, and "the chain is therefore built backward from the goal". | IMPULSE_STATE_SPACE_SPEC :204–220 |

**Not specified anywhere:**
- "first mile" or "last mile" (only CLAUDE.md states the contract);
- `mcpTool`, `activity_search` or activities-as-tools in any architecture doc;
- any tool-selection policy;
- the floor in the three foundation docs (E §3).

SUBSTRATE_AS_SOFTWARE :160–185 draws the walk as steps 0–8e with no forward mode.

**Where the docs and the live code diverge:**
1. **Who calls the floor.** sequences/04 :208–243 and README :42 put the floor *inside* the walk, per unmet
   shape. Live, it is called only from `runGoalWithRecoveryInner`: at `:13235` (REUSE) and `:13540` (after
   the walk).
2. **The tool list.** 04 :125 says "the tools discovery can reach". Live, it is the fixed
   `UNIVERSAL_READ_TOOLS` (`:4566`) plus `ufBuildWriteTool` (`:4601`) for `_write` targets only.
3. **The improvisation flag.** GLOSSARY :85 says "the trace-create payload carries the boolean
   `improvisation` field". activity-api accepts it (`execution-traces.ts:464`, `:2542`). Nothing in goal-host
   or ias-executor sets it (`grep -a`: 0 hits).
4. **Two mechanisms or one.** The old layer and the new layer contradict each other, and both are live doc
   text read by the drafter.

### 1.2 openspec: what was specified, and what was dropped without a destination

| Change | What it specified | Outcome |
|---|---|---|
| `2026-04-26-impulse-activity-loop` | Success = "reuse rate trends upward and improvise-share trends downward" (proposal :31). The `improvise` template's `gather_context` called `activity_search`/`trace_search`/`tool_pattern_search` (design :301). Phase 13: "minibob should function the same as Claude Code" (tasks :478–534). | 9/10 prompts at ≤1.5× LLM calls (LLM-call parity, not outcome parity; 13.S3 wall-clock 5–8× worse, unticked). **27.3.b.2/b.3 "improvisation succeeds; ribosome extracts from an improvise" are still `[ ]`** (tasks :1677–1682). None of the three `gather_context` shapes has a caller in goal-host or ias-executor today. |
| `2026-05-19-ias-executor-as-canonical-host` | minibob is "a god-object that fuses concerns that belong in distinct layers" (proposal :22–33). "Pushing logic down (activity → TS) hides state from the learning loop" (design :93–98). `GoalHost.runGoal` = recommend → load → execute (design :451–466). MCP protocol and goal-text→template mapping do not belong in the executor (design :547–576). | §J "What we lose" (design :578–650) concludes "No business-critical behaviour is strictly lost" (:647). **It never mentions `improviser.ts`, `search-first-executor.ts` or `agent-runtime.ts`.** `search-first-executor.ts` (1,469 LOC) was deferred and never migrated (tasks :314). |
| `2026-05-23-substrate-explicit-vessels` | The reason for removal is **centralization**: minibob was an implicit vessel whose in-process `ActivityExecutor` bypassed discovery and impulses; "minibob remains the sole executor. Lift cannot hand over…" (design :129–138, A1 rejected). Destinations: LLM → llm-resolver, tools → local-tools, ribosome → ribosome-vessel, boredom → boredom-vessel, seeding → bootstrap-seeder (proposal :63–67). | 8.1 `[x]` deleted `improviser.ts`, `template-extractor.ts` and `search-first-executor.ts` (tasks :174–177). **No task names a destination for the step-recording improviser or the search-first per-step reuse.** That is the unrecorded drop. |
| `2026-05-23-topology-discovery-loop` | "Auto-improvisation when escalation fails… warrants its own spec" (proposal :159–163, tasks :254–256). | Never written. |
| `value-per-cost-selection` | 1.6 `[x]`: floor runs were 72% of spend, because "tool-output context grows per iteration" (tasks :58–62). | A cost bound any forward mode inherits. |
| `2026-08-26-large-file-edit-capability` | "falls to the ReAct floor → the floor can't edit at all" (proposal :16–19). | Edits stay on `feature_compose`; the forward mode is not an edit path (§6). |
| `docs/specs/discovery-to-tools-bridge.md` (super-repo history only) | Added `9f91c137`, reworked `8a6bbcaa` (04-25, 796 lines, "draft"), archived `4167ba2a` (05-27), deleted `d1e60e40` (08-02, "the revision history is the archive"). The problem it named: the LLM's tool list was hard-coded, so concept-db tools were never offered and the model fell back to curl. Its design: a tool is an `mcpTool` impulse resolved per task; vessel score 0.4 shape + 0.3 keyword + 0.3 EMA; client score adds a global EMA and a Thompson channel; dispatch recorded in `resolution-tracker` with tier DISCOVERY. | minibob built the flow (`e05ecbd`, 04-26) but **not** the EMA, the Thompson term or the resolution-tracker record. The vessel side survives in concept-db and activity-api (§2.3). As of 07-10 `routedComplete` was "still tool-less" (`raw/memory-1.md:304`). **The same problem statement describes `UNIVERSAL_READ_TOOLS` today.** |

### 1.3 The gap store (live `gaps.json`, read 10-01)

Rows that bear on the runner. They are cited, not re-filed.
- `floor-tools-counter-reads-zero-…` (APPROACH §7: extend).
- `systematic-failure-universal-tool-fallback-zero` (open).
- `phantom-success-universal-tool-fallback-*` and `precondition-rejection-universal-tool-fallback-2026-09-18/-09-30` (open; misreads of the empty floor row, R7).
- `wasted-cycle-universal_tool_fallback` (open).
- `the-universal-executor-drops-execution-id-when-async-local-dispatch-context-is-empty` (open).
- `a-walk-treated-a-401-as-an-observation-and-reasoned-from-it` (open).
- `walks-feed-a-raw-execution-trace-dump-into-gpt-5-and-exhaust-the-spend-envelope`, with `route-edit-c95e1ac0` ("make the canonical gap-closing analyze task a single bounded LLM call: set tools…"). **Tool loops on tasks that need no tools are the measured cost failure.** A forward mode must be entered only on a stall, never offered by default.
- `failing-test-activity-api-impulses-mcptool-advertises-keyword-extractor-it-cannot-serve` (closed). The bridge already once advertised a tool it could not serve.

**No gap or record carries "improviser", "forward mode" or "activities as tools".**

### 1.4 What happened last time, and why it didn't hold

| Attempt | What it did | Why it did not hold |
|---|---|---|
| minibob `GoalImproviser` (04-04 → 05-06) | Per-step JSON decision with `expected_output_shape`; extraction on success (`87f101e`) and failure (`3d3f996`) | Edges were never recorded: every step wrote `inputState.impulses: []` (`improviser.ts:1438–1443`). `360e0de` (04-27) moved extraction to a lifecycle meta-activity that the improviser never emitted; the failure-path drop is documented in `ribosome-extract.json:258`. The success path is by inference, not tested. It was unplugged by a merge-aftermath fix (`8b918d2`). The extraction defaulted to `applyExtraction=false`, so it was observe-only. |
| minibob `improvise.json` + discovered tools (05-01 → 05-24) | A native tool loop over built-ins plus `mcpTool`; each tool output became a `memo` impulse; task-grain `input_impulse_ids` | One opaque LLM task per improvisation, so the extractable unit is the task, not the tool steps. It ran in the single in-process executor that explicit-vessels removed for centralization. |
| goal-host floor (`1cf0b96` 07-11 onward) | `universalToolFallback` → `runGroundedToolLoop`, a hand-written tool list | Seven "floor fixed" declarations were retracted (D §6). The loop runs two hops below the instruments: `tools=0/0` on 908/908 verdicts (APPROACH §1). Every learning attempt was a bolt-on after it returned (E R1). |
| `43247db` / `559a55d` (07-23/27) | Client-side loop; then "trust the wrapper" | The loop never fired, then grounding was accepted blind. The sibling `:9552` (now `:9561`) was missed (D §3.2). |

**The constant across all four:** the step was never a walk step. Every attempt ran its loop *beside* the
mechanism that traces, pools and extracts, then reported a summary to it.

---

## 2. The current sequence (live)

Legend:
- **T** = a persisted execution trace with tasks;
- **G** = a graded posterior or verdict label;
- **P** = an impulse added to the walk pool;
- **L** = log or tap only (the dispatch record's `walkLog` captures only `tap()`, `:7459`);
- **—** = none.

### 2.1 `/run-goal` → `runGoalWithRecoveryInner`

```
POST /run-goal                                   :17943 → handler
 ├─ SPEND-RATE BREAKER (refuse before any LLM)   :16031-16040   — (dispatch record only)
 └─ runGoalWithRecovery                          :12160 → runGoalWithRecoveryInner :12196
     1  FAILURE-RECALL (prior verdicts by goal_hash)      :12275-12283   L
     2  walk-concepts recall (concept-db via discovery)   :12447          L
        walk-catalog consult                               :12504          L
        gap-hydration                                      :12553          L
     3  TARGET INFERENCE inferGoalTargetDecision           :12583          L  (goal-target-inference.ts:436)
        + override pile (countable→shellResult, store-intent, derive-from-source,
          producer-lookup, compute-chain, named-shape bind)                 L
        inferDerivationSplit (intermediate | terminal)     :12821          L
     4  EARLY EDIT-INTENT → feature_compose                :12931-13200   T G (dev-vessel trace, deterministic label)
     5  recommendReachingPath (goal_hash, then shape sig.) :13207          — (read of goal_execution_paths)
     6  REUSE-BEFORE-DERIVE: pathway == floor → floor     :13233-13259   T(empty) G(judge) path-row; no P
        pathway head satisfier honoured                    :13267          L
     7  WALK runGoalAsPoolWalk                             :13268          (see 2.2)
     8  FEEDBACK-RETRY (fresh walk, verdict in synthesis)  :13304-13317   as 2.2, empty pool again
     9  hollow-satisfier retry (widen satisfier set)       :13386          as 2.2
    10  ALTERNATIVE-FRAMING (inference alternatives, once) :13420-13505   as 2.2
    11  FLOOR universalToolFallback                         :13538-13556   T(tasks:[]) G(judge) path-row ["universal-tool-fallback"]; no P, no mint
    12  edit-intent after a 0-step walk; recommend loop    :13571-14452   T G (template trace, mint :14425, path :14452)
```

**Cost of the order** (D §3.1, node 1, 437 dispatches, 09-26 → 10-01):
- median time from dispatch to floor entry is 94 s; p90 is 1,013 s;
- for `a30a893c` the floor started about 4 minutes in, after three full walks.

### 2.2 Inside `runGoalAsPoolWalk` (`:7394`)

```
seed pool: addToPool("goal") :9650, seed vars :9688-9710        P (walk-local ids walk-<shape>-n, producedBy constant — B1)
while (chain.length < MAX_STEPS && !targetMet())        :9880   (MAX_STEPS from selection-tuning, :7490)
  (0) VESSEL-RESOLVE SATISFIER, target order, no producer choice   :9890-10245   T G P  ← the step block
        vesselResolveShape :8347
          reached-command cache / lexical rebind (first mile, command grain) :8478-8542   L (+ cache write)
          (a.5) grounded investigation runGroundedToolLoop              :9526-9562   discarded (groundedOk≥1 gate, :9561)
          (b) ACTION-THEN-READ: LLM picks a sibling action shape       :9575, llmPickProducingAction :8286   P (:9639)
        persist walk-satisfier-N, addToPool :10150, ledgerStep :10234, recordStep{source:"satisfier", candidates:[]} :10242
        posterior satisfier:<shape>; proven-bad gate held behind env SATISFIER_PROVEN_BAD_ARMED :9963
  (a) CANDIDATES: discover-by-shapes mode:"backward" on pool        :10259-10290  (Thompson sampled_score, activity-api discover-by-shapes.ts:433)
  (a2) forward target-producer merge                                 :10301-10330
  (b) SELECT (scaffoldRank, feasibleProducer, REUSE-BEFORE-DERIVE pick) :10339, :10615-10626   G (source:"thompson")
  (b.h) horizontal OR-bundle                                          :10426-10560  T G P
  (c) BACKWARD-CHAIN: producers of missing targets → sub-targets     :10647-10680  — (no posterior gate)
  (c.2) MINT-AS-YOU-GO: author_producer via dev-vessel               :10691-10740  T (author trace), pick source "bridge"
        no producer, no live resolver → fileCapabilityGap / fileReachabilityGap   gap row; walk stops "no pick"
  (d) EXECUTE pick seeded with the pool (ias-executor)               :10848        T G
  (e) MERGE outputs into the pool                                    :10887-10925  P, ledgerStep, recordStep
judge verifyGoalReached                                              :11108        G (label)
answer impulses goal_answer / human_presentation (after the judge)   :11465-11475  P
mint: single trace :11732 / composite buildCompositeTraceFromChain :11757 → mintReachedTrace :11787   (grounded-gated)
recordGoalPath                                                       :11903 / :11938   path row
```

**Three facts about this sequence matter to the runner:**
1. **A forward pick exists, but only when there is no target** (D §2.1, `target.size === 0`). It is "any
   genuine forward progress" over pool consumers. That is the HOLLOW mode of the 09-29 memory need.
2. **The walk already has LLM-chosen steps.** `llmPickProducingAction` (`:8286`) has an LLM choose one of a
   vessel's sibling shapes, which are then resolved and pooled (`:9639`). The (a.5) investigation calls the
   same tool loop as the floor. So "the LLM chooses a step inside the walk" is not new. It exists in two
   narrow, ungraded forms.
3. **The `improvise` step source is declared and never assigned.** `WalkStep.selected.source` includes
   `"improvise"` (`:7283`); `grep -a -i improvis` finds no assignment. The slot the runner needs in the
   decision record is already there.

### 2.3 The organs the runner would use, as they are today

| Organ | Live state (probe 10-01/02, n = 1 unless stated) |
|---|---|
| `mcpTool` bridge, concept-db | 9 tools, all `concept_*`. `resolve_request_format: "mcp-tool"` via `/mcp/tools/call`, which is **not a shape resolve**. Scores are 0.15–0.19; the EMA term is a fixed 0.5 placeholder (`concept-db routes/impulses.ts:187-204, :258-261`). |
| `mcpTool` bridge, activity-api | 1 tool, `activity_search`, `resolve_request_format: "pointer"` (a shape resolve). Its score is a keyword count plus 0.15 (`routes/impulses.ts:3835-3933`). |
| `mcpTool` producers in discovery | 4 rows: `:8260`, `:8080` and **two via the federation ingress `:8401`**. |
| `activity_search` | Works. "search the web for current news headlines" returned `learned-composition-websearchresult-to-filecontent` first, then gap-closing drafts. **`metrics: null` on every match**, so search results carry no posterior. |
| `tool_usage` table (the store the bridge's EMA TODO names) | Defined, **0 rows**. Positive control through the same address: `goal_verification_labels` 14,681. |
| Consumers of `mcpTool` / `activity_search` | Only `development-vessel/src/resolvers/orphaned-capability-scan.ts`. 0 hits in goal-host and llm-resolver. |
| `discover-by-shapes` | Thompson-sorted by `sampled_score` (`activity-api services/discover-by-shapes.ts:321, :433`). It is the walk's ranker. |
| llm-resolver tool loop | `resolveToolEndpoint` (`:480-510`) takes `vessels[0]` from discovery and caches it for the process lifetime, with no locality check and no posterior. `dispatchTool` (`:514`) posts `{impulse:{pointer}}`. Returns `tool_calls` that the wrapper drops (A §2). |
| ias-executor `compose` | `engine.ts:691` dispatches a sub-activity with an ancestor cycle guard (`:1629`) and a nested trace. |
| goal-host floor reader | `runGroundedToolLoop` reads `j?.body?.tool_calls ?? j?.tool_calls` and **executes** them (`:5229`). This is the double-execution trap APPROACH step 1 guards against. |

There are **three rankers for one question** ("what should the next step be?"):
- the `mcpTool` score;
- `discover-by-shapes`' Thompson `sampled_score`;
- `activity_search`'s BM25/KNN score.

Only the second carries learned evidence.

---

## 3. minibob's sequence: designed, then what ran

### 3.1 Designed: `GoalImproviser` (`improviser.ts`, 1,724 lines)

```
goal → loop while !goalAchieved && step < maxSteps (default 50; old caller 10 × 3 turns)   :678
   LLM.complete (NO tools param) with a text tool list in the system prompt                 :694-699, :970-990
     → JSON {thought, action, params, step_purpose, expected_output_shape, goal_achieved}  :1044-1070
   run this.tools[action] (bash/read/write/edit/glob/grep [+activity])                      :778
   record ImprovisationStep {…, expected_output_shape, actual_output_shape, shape_validated} :30-46, :800-812
   impulses loaded (read/grep/glob) / created (write/edit, else fs snapshot diff)          :341-395, :918-936
   stop on goal_achieved (after a test run, 0fe8a80) | isStuck | maxSteps                   :859, :866
saveTrace → pseudo-template improvised-<slug> → POST /v2/activities/execution-traces        :1322-1530
   every step inputState.impulses: []  → NO EDGES                                           :1438-1443
extraction: 87f101e (04-04) direct → 360e0de (04-27) lifecycle meta-activity, never emitted by the improviser
```

**The behaviours worth keeping:**
- each step declares its *expected* output shape before acting, and records the *actual* one;
- each step records the impulses it loaded and created;
- the stop rule requires evidence (a test run) before claiming the goal.

**What was missing even then:** edges, extraction that actually fired, and any learned tool choice (the tool
list was prompt text).

### 3.2 What ran at HEAD (`677f8ff`)

```
CLI/REPL → processGoal (cli/processor.ts:617)
  backend mode → ActivityExecutor.execute(goal-processing-activity-driven)       processor.ts:991-1022
    impulse_state_analysis → context_acquisition → goal_enrichment (LLM)
    → activity_recommendation (POST /v2/activities/recommend; Thompson server-side)
    → variant_selection: first shape-compatible candidate, Thompson over variants;
                         else fallbackActivityId="improvise"                      goal-processing-activity-driven.json:22-26
    → activity resolver runs the chosen template
    → goal_verification (evidence_based) → [human] → goal_decomposition on failure (no recursion)
  improvise.json:
    gather_context: iteration over activity_search / trace_search / tool_pattern_search
    execute: one LLM task, executeWithLLM (activity.ts:5263)
       tools = built-ins + discovered mcpTool (per task, 30-min cache)            activity.ts:5561-5594; discovered-tools.ts:217, :443, :629-662
       native tool loop ≤ 20 iterations                                           llm.ts:391
       every call → toolCallRecords; each output → memo impulse tool:<name>:<task>:<ts>   activity.ts:5628-5735
       "DISPATCH_ACTIVITY: <id>" in text → activity-resolver runs that template   resolvers/activity-resolver.ts:82 (5178b17)
  trace: storeExecutionTrace → /v2/activities/execution-traces, task-grain input/output_impulse_ids   mcp.ts:351-505, :3064-3112
         composition edges → /v2/activities/composition/edges                    mcp.ts:2655
         lifecycle:activity:postExecution → ribosome-extract.json (applyExtraction=false)
```

**Activities as tools** (`tools.ts`):
- `activity`/`runActivity` (`:361`, `:390`; handlers `:1236`, `:1280`) run a nested `ActivityExecutor` with
  cycle detection, depth ≤ 3 and the remaining budget (`activity.ts:1434-1510`).
- `search_activities` (`:414`) filters by *category* only: GET `/v2/activities/templates`, not a query search.
- `createActivity` (`:458`) registers a template.
- These callbacks were wired only in `cli/goal.ts:116`, `cli/run-activity.ts:329` and `repl.ts:472`. On the
  single-shot path the tools answered "not configured".

**SearchFirstExecutor** (`search-first-executor.ts:357-400`; `goal --search-first`; boredom `boredom.ts:113`)
is the direct behavioural ancestor of the target:
1. It splits the goal into steps.
2. Per step, it calls `/v2/activities/recommend`.
3. If the top score is ≥ 0.3 it **reuses** that activity; otherwise it **improvises** that step.

That is step-grain ceiling/floor switching. It was deleted with no destination (§1.2), and its 0.3 threshold
was an in-process constant (a law-1 violation).

---

## 4. What was deliberately removed, and must not come back

| Removed | Why (source) | What it means for the runner |
|---|---|---|
| **A sole in-process executor** that runs goals, tools and activities in one binary | "minibob remains the sole executor. Lift cannot hand over…" (explicit-vessels design :129–138); "god-object that fuses concerns" (canonical-host proposal :22–33) | The runner is a *mode of goal-host's walk*, executing through discovery-resolved shapes and ias-executor. It is not a new service, and not an engine inside llm-resolver. The floor living inside llm-resolver's loop is this defect in miniature. |
| **Logic pushed down into TS where the loop cannot see it** | "hides state from the learning loop" (canonical-host design :93–98) | Step choice, offer construction and the stop rule are recorded per step as shaped data. Thresholds are shaped policy, never constants (law 1). |
| **A separate improvisation mode / `improvise_solution` template** | sequences/04 :131 ("read as retracted"); README :313 ("no improvisation mode"); 01 :388 | Forward steps are walk steps recorded with `source:"improvise"`. There is no "improvise" activity and no tier outside the walk. |
| **The model dispatching activities as free-form tools** (`DISPATCH_ACTIVITY:` text, `activity`/`runActivity` tools) | sequences/03 :259–261: "Nested dispatch is declared on the task, not offered to the model as a free-form tool" | The model *proposes* a candidate id from the offer. The walk executes it through its existing execute block, and the extracted template *declares* it as a `compose` task. The doc constraint holds at extraction time, and the depth cap stays enforceable. |
| **MCP protocol in the executor** | canonical-host design :547–576 | Tools are shapes resolved by pointer. The `mcp-tool` `/mcp/tools/call` format is not a step format (§5, S6). |
| **Hand-written tool lists in prompts** | Named in the departed bridge spec as the problem; `improviser.ts:970-990` | `UNIVERSAL_READ_TOOLS` (`:4566`) is the same defect, re-made in July. The offer comes from discovery plus posteriors. |
| **A client-side second ranker** (the spec's minibob-side EMA plus Thompson, never built) | It was never built; three rankers already exist (§2.3) | Extend one ranker. Do not add a fourth (§7, N1). |
| **Paths into the departed repo, and the CLI's name as a live subject, in docs that feed the drafter** | `8c3a5fa9` ("each one was grounding the drafter on a path that does not resolve"); `14cfaa63` (an earlier pattern pass made 128 wrong edits) | This file cites minibob by repo-and-commit as history. Nothing here should be copied into `docs/` as a live path. |
| minibob's auth (`minibob_record`, unsigned bearer) | REALIGNMENT §9 gap `activity-api-accepts-unsigned-minibob-bearer-tokens` | Not part of the runner. Listed because it is the one minibob residue still live and harmful. |

---

## 5. The target sequence: the runner is the walk's forward mode

**One dispatch, one pool, one decision record.** Backward chaining stays the default. Forward mode is entered
at a stall. It leaves when a step brings a learned pathway or a producer of the target into reach, or when an
answer impulse is judged.

```
POST /run-goal → runGoalWithRecoveryInner
  S1 CEILING: recommendReachingPath → learned pathway (goal_hash | shape signature, posterior-gated) ── reached ──► S11
  S2 BACKWARD: walk loop (satisfier → candidates → select → backward-chain)
        │ stall: no feasible producer | MINT-AS-YOU-GO declined | step posterior proven-bad | no target
        ▼
  S3 FORWARD STEP (repeats; budget = walkBudget shape):
     S4 offer  = rank( live resolvers' shapes ∪ activities (discover-by-shapes forward/backward on pool)
                       ∪ {activity_search} ), ordered by posterior in this context, targets as soft preference
     S5 choose = llm_completion in "return pending tool calls" mode (one resolver among many)
     S6 act    = shape → satisfier step block   |   activity id → execute block (d)
     S7 pool   = addToPool + ledgerStep with producer exec id + consumed ids
     S8 record = recordStep{source:"improvise", candidates:[…scores], expected_shape, actual_shape}
     S9 hand-off check: does the pool now feed a learned composite / a producer of the target?
           yes ──► back to S2 (last mile) or S1-pathway (first mile done)
  S10 ANSWER: goal_answer / human_presentation impulse consuming the observation ids → verifyGoalReached (full length, date)
  S11 EXTRACT: buildCompositeTraceFromChain(real per-step inputs) → mintReachedTrace → ribosome copies edges
  S12 next time: S1 finds the composite by shape signature → ceiling, or S9 finds it mid-walk → middle
```

### 5.1 Each arrow: the organ that already does it, and the gap

| Arrow | Existing organ (live) | Gap | Already in |
|---|---|---|---|
| S1 ceiling | `recommendReachingPath` `:6828`/`:13207`; REUSE-BEFORE-DERIVE `:13233`, `:10093`, `:10618`; Wilson ranking `785293c` | The floor node `["universal-tool-fallback"]` is borrowed by shape signature (294 borrow accepts vs 130 exact-goal accepts, 109 floor shortcuts, 65 unreached; C §4.3). There is no posterior gate on the backward-chain path (Beta(1, 63.2) passes as "learned"). | APPROACH step 2 (C4 interim); output-shapes step 4 |
| S2 backward | walk loop `:9880`–`:10848` | None for this track | — |
| S2→S3 stall detection | "no pick — missing shapes" `:10744`+; MINT-AS-YOU-GO `:10691`; `target.size===0` forward pick | The stall is a *terminal* today. The walk returns, and the floor starts after 1–3 more full walks with an empty pool. The walk returns no structured `missingTargets`/termination class. | D P5 (structured fields); **forward-in-place is new** (N3) |
| S4 offer, resolvers | discovery `/registry/shapes` + `/registry/shape-descriptions`; `mcpTool` bridge (vessel-side relevance) | Hand-written offer `:4566`; write-suffix filter `:5391`; `web_search` never offered even when the walk's own `web_search` succeeded (5bef2e86). The bridge covers only concept-db and `activity_search`. Its EMA is a placeholder; `tool_usage` has 0 rows. | D §1, P4 (held, §8) |
| S4 offer, activities | `discover-by-shapes` (Thompson `sampled_score`, `:433`); the walk's candidate step `:10259`/`:10301` | Today it feeds only the backward select, not an LLM's choice. | **new as an offer** (N1) |
| S4 offer, search | `activity_search` (`impulses.ts:4075`), working; positive control above | No caller in goal-host. Results carry `metrics:null`, so the model cannot see the posterior. | N1 |
| S4 ranking | three rankers (§2.3) | One question, three scores, one of them learned | **new** (N1) |
| S5 choose | llm-resolver tool loop `:688` (Anthropic) / OpenAI path | The loop runs *inside* llm-resolver, which picks `vessels[0]` and caches it forever; goal-host sees nothing (A §2). It needs a "return pending tool calls" mode. | APPROACH step 5 (a) |
| S5 → S6 transport | dev-vessel `llm-completion-dispatch.ts:450-492` | It drops `tool_calls`. Pending calls must travel under their own key, never under `tool_calls` (`:5229` re-executes). | APPROACH step 1 (b) + guards |
| S6 act, shape | satisfier step block `:10110-10245`: trace, `addToPool`, `ledgerStep`, `recordStep`, `satisfier:<shape>` posterior | Floor calls bypass it (`ufExecuteTool` `:4689`). The proven-bad gate is held behind env `SATISFIER_PROVEN_BAD_ARMED` (`:9963`; law 1). | D P4 / APPROACH step 4 |
| S6 act, activity | execute block (d) `:10848` (runs a template by id through ias-executor, pool-seeded); ias-executor `compose` `engine.ts:691` for the extracted form | None in mechanism. The rule is that **the model proposes and the block executes**. Extraction declares the step as a `compose` task (sequences/03 :259–261 satisfied). | **new as a rule** (N2) |
| S6 act, `mcp-tool` format | concept-db `/mcp/tools/call` | Not a shape resolve, so not a traced task. Only `pointer`-format tools are admissible as steps. | **new** (N2) |
| S7 pool + provenance | `addToPool` `:7553`, `ledgerStep` `:9771` | `producedBy` is a constant; ids collide; no consumed ids; `input_impulses` empty on 150,032/150,032 rows (B) | APPROACH step 3 (B1, B2) |
| S8 decision record | `recordStep` `:9861`; `WalkStep.selected.source` includes `"improvise"` `:7283` | The label is never assigned. Satisfier records have `candidates: []`. No expected-vs-actual shape (minibob's best idea). No counterfactual record of the offer at decision time (law 12). | **new** (N3) |
| S9 hand-off back | REUSE-BEFORE-DERIVE pick `:10618` (a step of a proven composition); `_pathHeadSat` `:13267`; `tryLexicalRebind` `:4320`/`:8542` | Only checked in the backward select and at walk start, not after a forward step. The search-first per-step threshold was dropped. | **new** (N4); REALIGNMENT §3.4 names lexical rebind as the middle tier |
| S10 answer | `goal_answer`/`human_presentation` `:11465-11475`; `verifyGoalReached` `:3620` | Built only *after* a reach. Does not consume observation ids. The judge is told "ZERO tools" (`:5482`); the judge has no clock. | APPROACH step 4; output-shapes preconditions |
| S11 extract | `buildCompositeTraceFromChain` `:11757`, `mintReachedTrace` `:7090`/`:11787`, ribosome-vessel | Floor never minted; positional edges (9/178 name a template id); 0/515 templates with edges; two owners with different gates | APPROACH step 3 (C2, C3), step 4 |
| S12 reuse | `recordGoalPath` `:6574`; borrow by shape signature | The floor row teaches the requested targets as produced (550/578) | APPROACH step 2 (D P3) |
| Budget | `walkBudget` shape (served `:17332`; read `:5156`) | None. Reuse it for the forward segment (law 1, law 5). The value-per-cost lesson applies: per-iteration context growth was 72% of spend. | existing |

### 5.2 Where backward chaining hands off to forward running, and back

**Down: backward → forward. One trigger, recorded as a route-around.** The forward segment starts at the
first of these:
1. The backward chain finds no feasible producer for a missing shape, and MINT-AS-YOU-GO declines or fails.
   This is today's "no pick — missing shapes" exit.
2. The only feasible producer is proven-bad. The gate exists, held at `:9963`; it must become a shaped
   policy, not an env flag.
3. Inference returned no target. Today this is the HOLLOW forward pick.

At that moment the §2.0b route-around record is emitted *in the walk* (need, missing producer, failed
producers), with `route_taken: "forward"`. D P5 places it at the floor decision site `:13538`. Under this
design it moves earlier, into the walk, where the structured `missingTargets` already exist as local state.

**Up, first mile: forward → ceiling.**
- A learned pathway exists for the goal family, but its head's input shapes are not in the pool.
- The forward segment produces them. After each forward step, S9 asks `discover-by-shapes mode:"backward"`
  on the new pool for a learned composite whose output covers the target and whose posterior passes the
  shaped threshold.
- If it finds one, the walk executes it (the REUSE-BEFORE-DERIVE pick, `:10618`).
- `_pathHeadSat` (`:13267`) and `tryLexicalRebind` (`:8542`) are the existing first-mile organs, at
  satisfier and command grain only.

**Up, last mile: forward → backward.**
- A learned pathway ran (S1), or a composite reached part of the way, and produced shape X, but the goal
  needs Y.
- The backward chain from Y is tried first, with X in the pool.
- Forward runs only if that stalls, and it starts from X, not from the goal string.

The re-frame (`:13420`) and FEEDBACK-RETRY (`:13304`) today restart from an empty pool. With a single pool
they become "continue forward from what was observed", which is D P6 generalized.

**Back down from the ceiling.** If an S1 pathway step fails at runtime, the walk does not discard the pool.
It marks the step failed (task with a deterministic reason, A6), and S2/S3 continue from the pool. This is the
step-grain version of minibob's search-first split, with the threshold held as a shape.

**What forward mode is *not* for:**
- **Edit-intent goals.** These stay on `feature_compose` (`:12931`). The large-file-edit change records that
  the floor "can't edit at all", and REALIGNMENT §9.0 holds widening writable shapes.
- **Goals the backward chain reaches.** Entering forward mode by default is the measured gpt-5 spend failure
  (§1.3).

---

## 6. Order relative to the agentic-floor APPROACH

This track does not reorder APPROACH. It adds a destination for its step 4/5 work. APPROACH puts floor acts
through the step block, then moves the loop to goal-host. This track adds that the loop then runs **in place
inside the walk at the stall point**, not after it returns. Concretely:

1. **APPROACH steps 1–3 are unchanged prerequisites:** visibility, stopping false learning, provenance.
   Without step 3, forward steps pool the same constant-provenance impulses as the walk.
2. **APPROACH step 4** (floor acts become walk steps) is the first time a forward step is a walk step.
3. **APPROACH step 5** (pending tool calls; goal-host executes) is the point where S5–S6 exist.
4. **Then N3** (enter in place at the stall) replaces the post-walk floor call at `:13540`. The REUSE floor at
   `:13235` stays until a minted forward composite exists to replace it as the learned pathway (A4 of the
   floor acceptance).

---

## 7. Proposals

Each item gives its seam, gate, builder and status. Builders:
- **(a):** goal-host `index.ts` and llm-resolver `index.ts`, which are excluded;
- **(b):** dev-vessel `llm-completion-dispatch.ts`, activity-api routes and services, concept-db,
  ias-executor, ribosome-vessel and `goal-target-inference.ts`, each with a class2 falsifier.

**Items already proposed elsewhere** are not restated: APPROACH steps 1–5; D P1–P6; C2/C3. The table lists
only what this track adds.

| # | Proposal | Seam | Deterministic gate (positive / must-fail) | Builder | Status |
|---|---|---|---|---|---|
| **N1** | **One ranker for the offer: extend `discover-by-shapes`, do not add a fourth.** Shapes with live producers and activities both enter as candidates. The `mcpTool` bridge and `activity_search` become *inputs* to it: the bridge supplies description and schema; search supplies recall for cold candidates. They are not separate scores. `activity_search` results carry the same posterior fields `discover-by-shapes` returns. The bridge's EMA term reads the existing `satisfier:<shape>` posterior, not a new `tool_usage` writer, because the satisfier posterior already exists per shape (law 3). `tool_usage` stays empty and is listed for retirement as data. | activity-api `services/discover-by-shapes.ts` (sort `:433`); `routes/impulses.ts` `activity_search` `:4075`; concept-db `routes/impulses.ts:187-261` | **Positive:** an `activity_search` hit for a template with a posterior row returns non-null `metrics`/`sampled_score`. **Must-fail:** today's 10-01 probe (`metrics:null` on 5/5 matches). **Positive:** a shape with a `satisfier:<shape>` posterior α>β gets a bridge score above 0.15. **Must-fail:** a shape with no posterior stays at the uninformed floor. | (b) | New as a consolidation. Bridge spec `8a6bbcaa` scoring kept vessel-side; its client-side EMA/Thompson was never built and should not be. |
| **N2** | **Step admissibility.** A forward step is either a `pointer`-format shape resolve, executed by the satisfier block, or a candidate activity id, executed by block (d) and extracted as a `compose` task. The model never dispatches. `mcp-tool`-format tools (`/mcp/tools/call`) are not offered until their vessel serves them as shapes. | goal-host forward-step dispatcher (a), at the satisfier block `:10110` and execute `:10848`. concept-db serving its 9 tools as pointer shapes (b). | **Positive:** a forward step choosing `concept_search` yields a `walk-satisfier-*` trace with `outputShapes` non-empty. **Must-fail:** a model-emitted id that is not in the offer is refused with a recorded reason (llm-resolver already refuses unoffered tools, `:522`). **Must-fail:** an extracted template whose activity step is not a `compose` task is refused at extraction. | (a) + (b) | New. It satisfies sequences/03 :259–261 instead of contradicting it. |
| **N3** | **Forward-in-place at the stall, with the dead label assigned.** Replace the walk's terminal "no pick" exit with the forward step, in the same pool, under the `walkBudget` shape. Every forward `recordStep` carries `source:"improvise"`, the offer (`candidates` with scores: the decision-time counterfactual, law 12), `expected_output_shape` (asked of the model) and the actual produced shape (minibob's `ImprovisationStep`, without its edge hole). The trace sets activity-api's existing `improvisation: true` field (`execution-traces.ts:464`), which nothing sets today. | goal-host `runGoalAsPoolWalk` at the `!pick` branch after `:10740` (a) | **Positive:** a goal whose walk today ends "no pick — missing shapes [X]" produces ≥1 `recordStep` with `source:"improvise"` and a non-empty `candidates`. **Must-fail:** a goal the backward chain reaches has 0 `improvise` steps (no default tool loop: the gpt-5 spend gap is the control). **Count row:** `improvisation:true` traces > 0 per day; today 0. | (a) | New in placement. It depends on APPROACH steps 1, 3, 4 and 5. Supersedes the post-walk floor call `:13540` only after acceptance A4. |
| **N4** | **Hand-off check after every forward step.** Re-run `discover-by-shapes mode:"backward"` on the new pool. If a learned composite covering a missing target passes the posterior threshold, return to the backward select or the pathway. The threshold is a shaped policy read at use time (the existing `selection-tuning` resolve, `:7490`), never a literal like search-first's 0.3. | goal-host forward-step loop (a); threshold field on the selection-tuning shape (b if served outside goal-host) | **Positive:** a planted goal whose first forward step produces the head input of a known reached composite then runs that composite (`REUSE-BEFORE-DERIVE` tap names it). **Must-fail:** a composite with α/n < threshold is not taken. | (a) (+b) | New as a per-step hand-off. It revives search-first's behaviour (dropped 05-24 with no destination) at step grain. |
| **N5** | **Doc expectation rows** (law 9; the docs-align loop, not a hand edit). Reconcile the two improvisation layers: IAF :455/:631–695 and ISS §4.5 against sequences/04 :120–131 and README :313. Fix 04's floor placement (:208–243), which is wrong today. The expectation to write: "improvisation is the walk's forward mode, recorded as `source:improvise`, extracted as a chain." Delete 03's malformed first diagram (:27–70). | docs-align family (REALIGNMENT §3.4 row) | **Must-fail today:** 04 :125 "every step lands in a trace" against 439/439 floor runs with `tasks:[]` (D §0). | (b) | Extends APPROACH §8 item 6. |

**Detector (law 6).** One §2.1 row: "Every dispatch whose walk ended with a structural no-pick either has ≥1
`source:"improvise"` step in the same execution, or a recorded hold reason."
- Must-fail today: every such dispatch. The `improvise` label count is 0 by construction (`:7283`, unassigned).
- It would have fired on 05-24, the day the last step-recording runner left the fleet.

---

## 8. What is held (§9.0), stated, not footnoted

**Held until §9.0** (shape locality plus caller authentication on resolve routes):
- **Widening the forward offer beyond the floor's current 5 read tools plus target write tools.** This
  includes any registry-wide, `mcpTool`-derived or relevance-ranked offer. The evidence:
  - discovery returns 4 `mcpTool` producers, 2 of them via the federation ingress `:8401`;
  - llm-resolver's `resolveToolEndpoint` takes `vessels[0]` with no locality check and caches it for the
    process lifetime (`:480-510`);
  - so a ranked offer today would admit tool advertisements from a peer, and route calls to them.
- **N1's ranker may be built and measured.** Its output must not be offered to a model until §9.0 holds.
- **The `web_search` one-shape exception** remains the user's decision (APPROACH §9 item 2).

**Not held** (no new address or write surface):
- routing the floor's *existing* calls through the step block (APPROACH step 4, N2's pointer rule);
- assigning `source:"improvise"` and the decision record (N3's record half);
- the hand-off check (N4), since it reads `discover-by-shapes`, which the walk already calls;
- the doc rows (N5).

---

## 9. Decisions for the user

1. **Forward-in-place (N3) replaces the post-walk floor.** It does not run beside it. Go/no-go uses the same
   parity battery as APPROACH step 5, on the same goal set, baseline first.
2. **The `tool_usage` table:** retire it as data (N1's position), or give it a writer. Law 3 argues for
   retiring it, because the `satisfier:<shape>` posterior already answers per-shape reliability.
3. **concept-db's nine `mcp-tool`-format tools:** serve them as pointer shapes (b), or leave them unoffered.

---

## 10. Limits

- **minibob:** read at `677f8ff` through a sub-read with file:line citations; the key claims were spot-checked
  in this session:
  - `improviser.ts:5`;
  - no constructor of `ImproviserResolver` outside its own file;
  - `ribosome-extract.json:258`;
  - the commit dates of `360e0de`, `e05ecbd`, `87f101e`, `0fe8a80`, `5178b17`, `8b918d2`, `67e3329`,
    `e534a72` and `814d215`.

  "Improviser success-path extraction never fired after 04-27" is inferred from the missing lifecycle emit,
  not tested.
- **Live probes are n = 1:**
  - the `mcpTool` resolves;
  - `activity_search`;
  - the `vesselCapability` lookups;
  - `tool_usage` = 0, with `goal_verification_labels` = 14,681 as the positive control.
- **Every proposal here is specified, not run.**
- **The sequence diagrams were read from source, not traced from a live dispatch.** The windowed measures
  (time-to-floor, floor census) are agentic-floor track D's, on node 1 only.
