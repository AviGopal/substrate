# Agentic runner census and approach — the walk's forward mode, with selection, search and activities as tools

2026-10-01/02. Read-only census; nothing was edited, dispatched or restarted. This is a **proposal to the
coordinator**, who owns REALIGNMENT.md. §8 lists the amendments it proposes.

**Evidence, one file per track** (file:line rows, method, census and prior art):
1. [tool selection by resolver relevance](1-tool-selection.md)
2. [one search tool](2-universal-search.md)
3. [activities as tools](3-activities-as-tools.md)
4. [the execution sequence, current and target](4-execution-sequence.md)
5. [history, 03-24 → today](5-history.md)

**This document sits on top of [agentic-floor/APPROACH.md](../agentic-floor/APPROACH.md)** and the
[output-shapes approach](../output-shapes/APPROACH.md).
- It does not reorder them. Their steps are this document's prerequisites.
- It replaces agentic-floor's endpoint, "the floor becomes walk steps, then goal-host runs the loop", with the
  design the user stated: **the agentic runner is the walk's forward mode.** It walks the existing distributed
  functionality, with:
  - tools selected by the relevance of their resolvers;
  - one search tool;
  - activities usable as tools.
- Every step feeds the shape mechanism.

**Not minibob.** minibob had these behaviours, but became bloated and centralized in one service. Nothing here
revives it.

---

## 0. Corrections

1. **`mcpTool` has no consumer**, contrary to my brief.
   - The "consumer" I named, development-vessel's orphaned-capability-scan, *excludes* `mcpTool`,
     `activity_search`, `trace_search`, `tool_pattern_search` and `discoverByShapesQuery` through its
     `META_DENY` list (`dv:1ef83560`, lines 129-130).
   - So the detector built to find advertised-but-unused capability is told never to look at exactly these.
2. **The "zero callers because nothing advertised it" text** is a code comment added by `c5fd43a` (07-30), not a
   07-26 note.
3. **minibob's `GoalImproviser` was already dead code on 05-06** (`8b918d2` removed its last caller). What minibob
   actually ran was:
   - the `improvise.json` template: one LLM task with a native tool loop over discovered `mcpTool` tools;
   - `search-first-executor.ts`: per step, reuse or improvise, at a fixed 0.3 threshold.

   The improviser's steps never recorded edges (`inputState.impulses: []`). So "restore" is partly wrong:
   **edges were never built, even then.**
4. **Discovery and `mcpTool`.**
   - The registry lists 4 `mcpTool` producers, 2 of them through the federation ingress on :8401.
   - A resolve is forwarded to concept-db only, so activity-api's entry is unreachable.
   - The two tracks' readings are consistent: one counted rows, the other followed the forwarding.
5. **The container clock had passed midnight UTC** during tracks 1–3, so some reads are stamped 10-02.

## 1. The finding

**The runner the design wants existed from 03-24 to 05-06 and was lost in one evening, 05-24, without a
record** (track 5).
- That day goal-host was created at 19:17 and minibob was removed at 22:45 (−0700).
- `GoalHost.runGoal` (`ie:fc63e4e`) threw an error when `recommend` returned nothing, so goals without a
  template had no path.
- Only 13 of minibob's 75 templates were ported, and `improvise` was not one of them.
- The pre-lift checks for improvisation and its extraction (27.3.b.2/b.3) were never ticked and are absent from
  `lift-status.json`. The same commit ticked the centralization check (27.3.g.1).
- No gap exists for the missing capability.

**Then every runner was rebuilt from scratch, without selection, search or compose:**
- auto-draft (454 unusable activities);
- the llm-resolver tool loop (07-10);
- the 07-11 and 07-23 floors on 5 hand-written tools, built a day and two weeks after the user's 07-10 directive
  that `mcpTool` is how the LLM gets tools, "not a hardcoded" list;
- mint-as-you-go (never called).

**The docs removed the evidence rather than file a gap.**
- The bridge spec (`8a6bbcaa`) and the improvisation spec were deleted on 08-02.
- The improvisation doc was rewritten on 08-05 around `mintResolverWrapper`, which was deleted the next day.
- They now contradict each other:
  - IMPULSE_ACTIVITY_FOUNDATION and IMPULSE_STATE_SPACE_SPEC §4.5 say "improvise with recording";
  - sequences/04 and README:313 say "there is no improvisation mode".

**The organs survive. Each lacks its consumer or its contract:**

| Behaviour | Organ alive today | What's wrong with it | Track |
|---|---|---|---|
| **Selection by relevance** | `mcpTool` producers on activity-api and concept-db | **Advertised:** 10 catalog entries.<br>**Usable:** only 1 (`activity_search`) can run under either live tool executor; 9 are MCP tool names, not shapes, and 5 of concept-db's 9 are writes.<br>**Scoring:** a flat 0.15 on realistic queries; the per-tool EMA is a constant and `tool_usage` has 0 rows.<br>**News goal:** `web_search` is in no catalogue. | 1 |
| | Ranking signals | The only per-step, context-keyed signal is satisfier posteriors (828 rows). These are poisoned: `webSearchResult` is at α12/β464, and goal-host holds suppression until a re-baseline whose gap is missing from the live store.<br>**Three rankers answer "what next".** | 1, 4 |
| **Search** | `activity_search` | No semantic path ("no embedding provider"). Draft rows dominate results; it returned a retired row. `metrics` is null on 14/14 hits. Results carry no `input_shapes`. It never returns resolvers, so `web_search` cannot be found. | 2 |
| | `trace_search`, `tool_pattern_search` | `trace_search` only substring-matches the activity id. `tool_pattern_search`'s table has 0 rows. | 2 |
| | `discoverByShapesQuery` | The one surface with real callers (21,798 resolves since 09-26), but it needs an exact shape name: it selects, it doesn't search. | 2 |
| | Shape descriptions | Volatile (312, then 56, now 286 of 407) and partly invented (`mcpTool` is described as "molecular computation"). goal-host reads none. | 2 |
| **Activities as tools** | Activity-id-as-resolver (`7ba0322`) | 194 live templates use it; 263 composed traces in 7 days. `compose` itself has 0 of 3,978 users, because development-vessel rewrites it to this form at registration (`3ba1c45`). | 3 |
| | `activity` resolver | Returns a one-line summary, and passes the child no impulses, tags, cycle chain or budget. 59,693 of 60,404 traces skipped it, and the skips count as success. validator-dispatch failed 586/586. | 3 |
| | The walk's execute block (d) | `:10848`. Runs a template by id, pool-seeded, as the walk's next link. | 3, 4 |
| | Credit for composed children | **0 of 369** composed children earned anything. `parent_execution_id` carries three relations (lifecycle subscriber, composed child, next walk step), and ingest cannot tell them apart. | 3 |

**The walk already contains a forward mode in name only** (track 4):
- the step source `"improvise"` is declared (`:7283`) and never assigned;
- the walk has two LLM-chosen steps (`llmPickProducingAction`, the investigation loop), neither graded;
- the floor runs as a second engine, after up to three full walks, from an empty pool.

## 2. The target sequence

One dispatch, one pool, one decision record. **Backward chaining stays the default; forward mode is entered
in place at a stall.** Track 4 §5 has the full diagram and the organ for every arrow.

```
S1 CEILING   learned pathway (goal_hash | shape signature, posterior-gated) ──reached──► S11
S2 BACKWARD  walk loop: satisfier → candidates → select → backward-chain
             │ stall (no feasible producer and mint declined | only producer proven-bad | no target)
             │   → §2.0b route-around record, route_taken:"forward"
             ▼
S3 FORWARD   repeat within the shaped walkBudget:
  S4 offer   ONE ranker: local resolvers' shapes (with descriptions and input contracts)
             ∪ activities (discover-by-shapes on the current pool) ∪ the search tool;
             ordered by posterior in this context; targets are only a soft preference
  S5 choose  llm_completion, "return pending tool calls" mode (one resolver among many)
  S6 act     shape        → the satisfier step block (trace, pool, ledger, Thompson)
             activity id  → execute block (d), recorded as a compose task
  S7 pool    impulse with producer execution id + consumed ids
  S8 record  source:"improvise", the offer with its scores (counterfactual), expected and actual shape
  S9 handoff does the pool now feed a learned composite or a producer of the target?
             yes → S1 (first mile) or S2 (last mile)
S10 ANSWER   human_presentation impulse consuming observation ids → judge (full length, date, evidence)
S11 EXTRACT  composite from real per-step inputs → mint → ribosome copies edges
S12 REUSE    next time S1 finds it by shape signature (ceiling), or S9 finds it mid-walk (middle)
```

**The three behaviours, as single rules:**
1. **Selection.** The offer comes from one ranker that already exists: `discover-by-shapes`, which already
   computes Thompson `sampled_score`. It is extended to return resolver shapes as well as activities, instead of
   adding a fourth ranker. The `mcpTool` bridge becomes how vessels advertise **callable** tools (pointer shapes
   only) into that ranker, not a parallel catalogue.
2. **Search.** One shaped read: `activity_search` extended into a typed union of activities and locally
   advertised, described, read-only shapes. Each item carries its input contract and posterior.
   - The search tool can surface `web_search`.
   - The same read serves §2.0b's "inference reads descriptions" (one organ, two readers).
   - **A search result is callable on a later step**, which needs goal-host to own the loop (S5). Inside
     llm-resolver's loop today, a search can inform the model but cannot extend what it may call.
3. **Activities as tools.** The model **proposes** an activity id, and **the walk's execute block runs it** as
   the next link of the chain. Extraction records it as a `compose` task.
   - No new in-process entry point.
   - No model-dispatched execution (sequences/03 stays true).
   - Credit comes through the chain, as for any walk step.
   - Templates that write, call back into goal-host, or are already in the chain are filtered out of the offer.

**Must not come back** (track 4 §4):
- a single in-process executor service;
- a separate improvise mode or engine;
- the model dispatching activities itself;
- MCP protocol inside the executor (concept-db's `mcp-tool` format is not a shape resolve, so it is not a step);
- hand-written tool lists;
- a fourth ranker.

## 3. Why it was lost, and what is different this time

**Governing reasons** (track 5 §3, agentic-floor E §2):
- **Ported without consumers.** The `mcpTool` producers, `compose`, `activity_search` and the `activity` resolver
  all survived the port; their callers didn't.
- **Re-implemented from scratch elsewhere, ignoring the surviving organs.** Four runners since 05-24, none using
  the bridge.
- **Detectors exempted the class.** `META_DENY` means the orphan scan can never flag the unused tool producers.
  It is the hardcoding census's "detectors exempt their class" pattern.
- **Docs deleted the specs instead of filing a gap.**
- **Extraction was off by default** from 04-27 to 06-30 (goal-host) and to 08-03 (ribosome-vessel). minibob's own
  `ribosome_activation_rate` read 0 on every report examined, and nobody acted.

**Different this time:**
- **Prerequisites first.** Agentic-floor steps 1–3 must hold before any runner step is relied on:
  - calls visible;
  - no false learning;
  - edges in the mechanism.
- **Every organ named here gets a reader before it is extended** (law 3, track 5).
- **Detector exemptions are removed** (step R0).
- **Acceptance is measured at the consumer:** a runner-minted template is selected for a different goal and
  reaches (§5).

## 4. Approach, in order — the order of record for all three documents

**qa review (10-02): all five load-bearing claims confirmed; accepted with changes, applied here.** This
section is the **single order** for this document, [agentic-floor](../agentic-floor/APPROACH.md) and
[output-shapes](../output-shapes/APPROACH.md). Their own sections are referenced from here, and their own
orders are superseded.

**Builders,** from the live `autonomyScope` (read 10-01; admission requires a class2 falsifier):
- **(a):** operator bootstrap, for goal-host `index.ts`, llm-resolver `index.ts`, discovery, development-vessel
  core and `posterior-update.ts`.
- **(b):** a dispatched goal, for activity-api routes, concept-db, ias-executor, ribosome-vessel, local-tools,
  development-vessel `llm-completion-dispatch.ts`, and goal-host `goal-target-inference.ts`.

**Line references.** goal-host refs are at `76bb373`. Live is `a72918f`: refs between `:399` and `:8348` are +1,
and refs after `:8348` are +9. Re-pin at build time.

**Rules for every step:**
- one change per landing (law 12);
- controls are in the track file cited;
- nothing widens what is addressable before §9.0, except where marked;
- **every battery or parity run writes to a sandboxed store** (REALIGNMENT §2.5), never the live memory, gap or
  trace stores;
- the user has ruled (§9). Every (a) item is cleared **subject to qa review before it lands**; (b) items go
  through the lane as check-first gaps.
- **Ownership (10-02):** this work is the coordinator session's objective. The human-surface session works on
  the interface only and asks, never edits, for executor changes.

### Step 0 — contain the floor's shell (qa: HIGH, live hole)
- The floor's `shellResult` resolves to local-tools `shell` (`bash -c`, working directory = the live super-repo).
  That path is outside the 10-02 containment fix (dev-vessel `c6262c3f`, local-tools `3815e9e7`, goal-host
  `a72918fd`), which refuses write and commit **shapes**, not shell commands.
- Nothing stops a repeat of `GPT-5.md` today.
- **Gap:** qa filed it critical as `floor-shell-tool-still-writes-and-commits-in-the-live-super-repo-past-the-containment-fix`.
- **First, before anything that makes the floor more effective.** Details: [agentic-floor step 0](../agentic-floor/APPROACH.md).

### V — the vertical slice: `a30a893c` end to end on both nodes (qa: name it, let it order the rest)

**Goal.** The smallest subset that runs the news goal end to end, producing:
- a **route-around record**;
- a **chained output**: evidence → dated answer, with edges;
- a **minted template that carries those edges**.

**What the slice does not need.** It uses the **walk's existing backward chain and its existing local
satisfiers** (`web_search`, `llm_completion`): the main walk already bound search results into a grounded report
once (cea3f4a4 #1). So the slice needs:
- no forward mode;
- no widened tool offer;
- no floor changes.

That is why it can run before §9.0.1.

| # | Item | Builder | From |
|---|---|---|---|
| V1 | **The `/deliverable-shapes` gate:** evidence of a reached run **and** a live advertiser. Inference stops aiming at `obsidian:write_note`, and the walk stops filling its chain with the dead terminal's producers. | (b) | output-shapes step 0 |
| V2 | **The current date at synthesis and at the judge**, as a deterministic read, never prompt text (the open date gap) | (a) | output-shapes step 3 |
| V3 | **The judge reads the deliverable first, at full length.**<br>• Junk shapes are excluded.<br>• `completion_shapes` is restricted in code.<br>• A cut view abstains (§9.2). | (a) | output-shapes step 3 (G2) |
| V4 | **Edges are declared only when bound** (B4), **plus one pool with real producers and consumed ids** (B1), **plus composites built from real per-step inputs** (B2) | (a) | agentic-floor steps 2–3 |
| V5 | **The extractor copies edges and refuses collapse** (C3) | (b) | agentic-floor step 3 |
| V6 | **A route-around record when the walk stalls or re-frames** (need, missing producer, failed producers, route taken), at the stall site where `missingTargets` is local state | (a) | agentic-floor D P5, track 4 §5.2 |

**Slice acceptance.** Each criterion holds per node, measured at the consumer.
- **Clean dispatch.** A dispatch of `a30a893c` logs an inference line with no unadvertised target.
- **Grounded answer.** The answer `llm_completion` consumes the `web_search` impulse id, carries today's date, and
  is judged on its full text.
- **Edged composite.** On a reach, the composite has ≥ 2 tasks with real edges, and the minted `learned-*` row
  carries `dependencies`.
- **Reuse.** A re-dispatch **with different wording** (a different `goal_hash`) selects that template and reaches.
  This is agentic-floor A4 at the smallest scale.
- **Route-around.** At least one route-around record exists for the goal family.

**Must-fail controls:**
- on the parent sha, the same dispatch ends "missing shapes [obsidian:write_note]";
- the stored 10-01 08:57–08:59Z rows declare `web_search` consumed by goal-only prompts.

**Node 2** runs spoke-style (activity-api and concept-db are inactive there). The slice must show node 2
resolving the hub's producers through discovery. Track 5 did not test this, so it is the slice's first check
on node 2.

**Known risk.** Without G1, the LLM judge may still reject a grounded report on format, as it did twice for
cea3f4a4. If the slice's judge rejects a report that V2 and V3 show was grounded and dated, G1
(output-shapes step 3) joins the slice. Its must-fail control is the false reach "October 27, 2023".

### After the slice, in order

1. **Instrument the floor:** agentic-floor step 1, under the step 0 containment. The positive control is the
   **sandboxed** line-count control, never a `27c1c600`-style run.
2. **Stop the rest of the false learning:** agentic-floor step 2.
   - produced-only floor credit;
   - the `:9552` sibling call site;
   - the receipt filter;
   - the interim borrow requires an exact `goal_hash` match.
3. **Retention and the always-built, labelled `answerBody`** (a), and the **run view's best-output block** (in the
   human-surface grant). This is what the person sees.
4. **R0 — make the loss visible (b).** Remove the search and tool shapes from orphaned-capability-scan's `META_DENY`.
   - **In the same landing, change what the scan prescribes for those shapes.** Their findings attach to the one
     consolidating gap, not to new orphan gaps that each prescribe a mint (qa: MED).
   - Add the §2.1 row "every `mcpTool` catalogue entry names a callable shape". Must-fail today: 9/10 entries
     uncallable, and `keyword_extractor` lived 16 days.
   - **Gap: extend `floor-tools-counter-reads-zero-…`; don't mint a new one** (qa: MED).
     - Its scope widens to "the floor/runner has no visible, selectable, searchable, composable steps".
     - Its falsifier gains §5 S1–S6.
     - It names the gaps it supersedes: the `phantom-success-universal-tool-fallback-*`,
       `systematic-failure-universal-tool-fallback-*`, `wasted-cycle-universal_tool_fallback` and
       `lost-reached-verdict-universal-tool-fallback-*` families, and `minted-copy-of-the-floor-shadows-the-floor`
       (which stays as a standing must-fail).
   - Docs: one doc-expectation row reconciling the two improvisation layers.
5. **R2a — the one search read, activities only (b).** `activity_search` with:
   - input contracts;
   - non-null posteriors;
   - retired and draft rows excluded;
   - grading by use, recorded as impulse relevance.

   **Resolver shapes are not added to its results** until §9.0.1.
6. **The remaining output-shapes items:**
   - retiring the goal-only writers as data (b);
   - the provenance filter and re-frame binding (a);
   - failure memory into inference (b, `goal-target-inference.ts`).

### Held until §9.0.1 (shape locality) and route authentication (qa: HIGH)

"Read-only" is a label, not a property: `shellResult` is labelled read-only and wrote `GPT-5.md`. So the
following wait for §9.0.1. This also resolves the contradiction with agentic-floor step 5.
- **R2b — `discover-by-shapes` ranks resolver shapes** for the offer (track 4 N1, track 1 P1).
  - The posterior term also waits on the satisfier re-baseline.
  - **Before restoring that gap, run a positive control:** the gap-store read must find a known-present gap
    (qa: MED). A missing gap is otherwise unattributed.
- **R3 — forward steps through the walk's own blocks (a).**
  - The offer is R2b's output plus search.
  - A shape choice goes through the satisfier step block.
  - An activity choice goes through execute block (d), extracted as `compose`.
  - The offer filter excludes templates that write (1,017/2,778), call back into goal-host (23), or are ancestors
    in the chain (b).
  - Each step records `source:"improvise"`, the offer with its scores, and the expected and actual shape.
  - `step_source:` tags separate the three relations on `parent_execution_id`.
- **R4 — forward mode in place at the stall, with handback after each step (a).**
  - It needs agentic-floor step 5's "return pending tool calls" mode.
  - It replaces the post-walk floor only after a baseline-first parity battery, run in a sandboxed store.
- **Also held:**
  - peer producers in any offer (a tool impulse names its own address, and our ApiKey is attached on dispatch);
  - write shapes or write-bearing activities;
  - remote `activity_execution`;
  - per-producer credit.

### R5 — answer, extract, reuse
- The answer is a `human_presentation` impulse consuming observation ids, judged at full length with the date.
- Extraction comes from the real chain.
- The ceiling then finds it by shape signature. The slice proves the walk half; R3–R4 extend it to forward
  steps.

## 5. Acceptance

**Preconditions.** Until all hold, every criterion is "not evaluable":
- agentic-floor P0.1–P0.3;
- **P0.4:** §9.0.1 (shape locality) and route authentication hold for tool dispatch. Today they fail, so S1–S3
  are not evaluable. The vertical slice V is evaluable without them, because it widens nothing.
- **P0.6:** step 0's containment holds. A floor shell command creating a file under the super-repo leaves no
  file and no commit.
- **P0.5:** every runner step leaves a record of its shapes and its impulse ids (track 5).

**Criteria** (track 5 §4). Each runs on both nodes, as a standing check, with positive and must-fail controls:
- **S1 — selection:** the offer for a step comes from the ranker. Must-fail: a hand-written list in the floor.
- **S2 — search is consumed:** a search result is called by a later step in the same dispatch.
- **S3 — activities as tools:** an activity chosen as a tool yields a child execution, linked as a chain step,
  with a composition edge.
- **S4 — extraction names producers:** extracted templates name the step producers and are not copies of the
  runner (no `universal-tool-fallback` or `improvise` node).
- **S5 — reuse:** a runner-minted template is selected for a different `goal_hash` and reaches, at either the
  first or the last mile.
- **S6 — search before mint:** no mint-as-you-go or author_producer fires in a dispatch whose search returned a
  live producer of the missing shape.
- **Durability:** 14 days with no reopen, plus agentic-floor A1–A8.

**The case to watch:** goal `a30a893c`. It should reach a stall on the missing deliverable, search, find
`web_search`, use it, answer with a dated `human_presentation` consuming the results, mint the chain, and on
its next dispatch reach through the ceiling.

## 6. What the substrate can do itself ((b)), and what needs you — after the user rules

The user ruled on 10-02 (§9); the hold is lifted.

**(b) items in the slice:**
1. V1: the `/deliverable-shapes` gate.
2. V5: the extractor copies edges.

**(b) items after the slice:**
3. R0, with the scan's prescription changed in the same landing.
4. R2a: `activity_search` over activities.
5. Retire the goal-only writers as data.
6. `goal-target-inference.ts` items (failure memory into inference; rejecting unadvertised targets).
7. Fix or retire the `activity` resolver (decision 2).
8. Fix the stale nested-execution test.
9. The development-vessel wrapper's transcript forward (agentic-floor step 1). This goes **after step 0**.

**Held until §9.0.1:** R2b's resolver ranking; R3's offer filter, which is only useful with R3.

**(a), cleared by the user on 10-02, each subject to qa review before landing:**
- step 0's sandboxed-shell seam, if it lands in `scripts/substrate` or goal-host;
- V2, V3, V4 and V6;
- the goal-host half of agentic-floor steps 1–2;
- retention and `answerBody`;
- later, R3–R4 and llm-resolver's pending-tool-calls mode.

**Inside the human-surface grant:** the best-output run view.

## 7. Gap ledger (proposals only; no ledger writes until the user rules)

| Gap | Action |
|---|---|
| `floor-shell-tool-still-writes-and-commits-in-the-live-super-repo-past-the-containment-fix` | **Filed by qa (critical).** Step 0. |
| `floor-tools-counter-reads-zero-…` | **Extend; this replaces "file a new runner gap"** (qa).<br>• Widen its scope.<br>• Add S1–S6 to its falsifier.<br>• Name the superseded families (step 4 of "After the slice"). |
| Satisfier re-baseline gap named by goal-host's interlock | **Before restoring it, run a positive control** that the gap-store read finds a known-present gap (qa). Then restore it if it is truly absent. |
| `orphaned-capability-scan` `META_DENY` | **Remove the exemption and change the prescription in the same landing** (R0). |
| `keyword_extractor` catalogue entry (opened and closed 09-30) | **Cite** as R0's must-fail control. |
| Failing nested-execution contract test (filed 09-30) | **Fix the test,** not the code (track 3 P5). |
| validator-dispatch 586/586 failures | **Port the template lookup, or retire it** (decision 2). |
| `shape_producer_inventory` always "0 producers" | **Closed:** landed autonomously as activity-api `a5e52db` (10-02), `landed_verified`. It reads `content.vessels` by `vesselId`. |
| output-shapes and agentic-floor ledgers | Stand as amended there (reopen and close rules per qa). |

## 8. Proposed REALIGNMENT amendments (for the coordinator)

1. **§3.3 / §3.4: add the tool bridge, `activity_search` and execute block (d) to the core toolset,** each with
   its named caller (the forward step). REALIGNMENT never mentions `mcpTool`.
2. **§2.0b: the floor is the walk's forward mode, entered in place at a stall,** not a post-walk engine. The
   route-around record is emitted at the stall, inside the walk.
3. **§2.0: "one ranker".** The step offer, the backward select and the borrow share `discover-by-shapes`. No
   fourth ranker.
4. **§4 fossils: the `activity` resolver** (59,693/60,404 skipped and counted as success) and validator-dispatch
   (586/586 failed).
5. **§6.2 anti-pattern evidence: the 05-24 port.**
   - Pre-lift checks 27.3.b.2/b.3 were never ticked while 27.3.g.1 was.
   - Detector exemption of the exact class (`META_DENY`).
   - Specs deleted on 08-02 instead of a gap being filed.
6. **§9.0: a tool impulse that names its own dispatch address, with our credential attached on dispatch,** is
   the same injection class as the human-ask route.

## 9. The user's rulings (10-02)

The decisions this section used to list were ruled on by the user. In their words, then how each applies:

1. **Walking is additive.** "Walking should be a partially additive process, moving down the steps required to
   reach the output shapes with valid impulse content. Being able to continue after a retarget or
   re-evaluation is essential to this."
   - A walk accumulates. Re-frames, retargets and FEEDBACK-RETRY continue from the pool already built, never
     from an empty pool.
   - Forward mode is entered **in place** and is additive, not a separate engine after the walk. The parity
     battery (baseline arm first) stays the go/no-go for switching the floor over.
   - output-shapes T2 P2 (a retry seeds the prior attempt's intermediates) and R4 ("continue forward from what
     was observed") are core, not optional.
   - A step is measured by whether it moves the pool toward the target shapes with valid impulse content.
2. **Individual resolvers are not decisions for the user.** "Whether we fix a particular resolver or not is
   irrelevant, so long as the system can use its existing capabilities (including already known activities) to
   reach more reliably and in fewer steps; that is the end goal."
   - The former decisions 2, 3 and 6 (the `activity` resolver and validator-dispatch, concept-db's MCP-format
     tools, `tool_usage`) are judged only by whether they serve reliable, fewer-step reach through existing
     capabilities and known activities.
   - The success metric is reach reliability and step count on reuse of known activities.
3. **An activity is a step.** "Activities are not nested so much as they should be treated as a step in and of
   themselves. Like any producer of impulses they get credit when they are involved in achieving a goal."
   - An activity used in a walk appears as a chain step, its output impulses enter the pool, and it earns
     credit when the goal is reached. This settles former decision 4: credit by involvement
     (`posterior-update.ts`, (a)).
   - R3 and track 3 P1 are reframed: the execute-block step recorded as a chain link is the model, not nesting.
     The three-relations tag on `parent_execution_id` still separates a walk step from a lifecycle subscriber.
4. **Clearances.** All operator (a) fixes are cleared, provided qa reviews each before it lands.

**Still open:** whether the runner may ever offer write-bearing activities or write shapes (former decision 5).
Until it is ruled, nothing write-bearing is offered.

## 10. Findings for the coordinator (not folded in)

- **`shape_producer_inventory` always answers "0 producers".** It reads `vessels` where discovery returns
  `content.vessels`. Through the same address, `vesselCapability` returns 5 producers for `web_search`.
- **The semantic search path is dead** ("no embedding provider configured"), so every `activity_search` runs as
  full-text.
- **The satisfier re-baseline gap** that goal-host's own interlock depends on is absent from the live store.
- **IMPULSE_ACTIVITY_FOUNDATION.md:1130** claims the `activity` resolver proves nested execution "works one level
  down". It does for linking, not for data.

## 11. Verification status

- Everything here is **specified, not run**.
- The track files hold the live reads (registry, `mcpTool` resolves, `activity_search` probes, SQL counts), each
  with its window and control.
- The metabob cockpit's goal-host and registry tools failed throughout; everything was read through `127.0.0.1`
  and `docker exec`.
