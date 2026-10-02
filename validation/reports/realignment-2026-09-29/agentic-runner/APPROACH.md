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

## 4. Approach, in order

**Builders,** from the live `autonomyScope` (read 10-01; admission requires a class2 falsifier):
- **(a):** operator bootstrap, for goal-host `index.ts`, llm-resolver `index.ts`, discovery, development-vessel
  core and `posterior-update.ts`.
- **(b):** a dispatched goal, for activity-api routes, concept-db, ias-executor, ribosome-vessel, local-tools,
  development-vessel `llm-completion-dispatch.ts`, and goal-host `goal-target-inference.ts`.

**Rules for every step:**
- one change per landing (law 12);
- controls are in the track file cited;
- nothing widens what is addressable before §9.0, except where marked.

### R0 — make the loss visible (b; first, cheap, independent)
- **Remove the search and tool shapes from orphaned-capability-scan's `META_DENY`**, and add a §2.1 row: every
  `mcpTool` catalogue entry names a shape its producer serves (track 1 P4, track 2 P5). Must-fail today:
  - 9 of 10 entries are uncallable;
  - the `keyword_extractor` entry lived 16 days because nothing reads the catalogue.
- **File the missing gap:** "the substrate has no runner for goals without a learned pathway that selects,
  searches and composes".
  - Its falsifier is §5's S-criteria.
  - Its history is track 5's timeline.
  - It consolidates the floor-family gaps rather than adding beside them.
- **Docs:** one doc-expectation row reconciling the two improvisation layers (track 4 N5).

### R1 — agentic-floor steps 1–3 (prerequisites, unchanged)
- Visible tool calls, with both guards.
- Produced-only credit and bound-only edges.
- One pool with real provenance, composites from real inputs, and an extractor that copies edges.

### R2 — the one ranker and the one search read (b)
- **Ranker.** Extend `discover-by-shapes` (activity-api `services/discover-by-shapes.ts`) to rank **resolver
  shapes** as well as activities against the current pool and goal (track 4 N1).
  - Locally advertised, read-only shapes only, until §9.0.
  - The posterior term stays off until the satisfier re-baseline (track 1), so ranking is lexical and
    descriptive meanwhile.
  - The re-baseline gap that goal-host's interlock names must exist in the live store first.
- **Search.** Extend `activity_search` into the typed union (track 2 P1), with:
  - input contracts on every item;
  - non-null posteriors;
  - retired and draft rows excluded;
  - the discovery read through the typed §9.1 seam.

  Search then learns from use: a result counts as used if it is consumed by a later step, and as helpful if it
  sits in a reached chain. That is recorded as impulse relevance (track 2 P3), and it feeds the per-tool prior
  that is a constant today.
- **The `mcpTool` producers** advertise only pointer-shape, callable tools into this ranker. activity-api lists
  its own-origin advertised shapes with description and schema (track 1 P1).
  - Concept-db's MCP-format tools are either served as pointer shapes or dropped (decision 3).

### R3 — forward steps through the walk's own blocks (a)
- **The offer.** The forward step's offer is R2's ranker output plus the search tool. Hand-written lists are
  retired as data (track 1 P3).
- **Acting on a shape.** A shape choice goes through the satisfier step block (`:10110-10245`).
- **Acting on an activity.** An activity choice goes through execute block (d) (`:10848`), pulled into one shared
  function. It is recorded as the next chain link and extracted as a `compose` task (track 3 P1, track 4 N2).
- **The offer filter (b, activity-api).** Exclude templates that:
  - write (1,017 of 2,778 contain a file-write or git task, and the 10-01 containment does not check template
    steps);
  - call back into goal-host (23);
  - or are already ancestors in the chain (track 3 P2).
- **The decision record.** Each step assigns `source:"improvise"` and records the offer with its scores (the
  counterfactual at decision time, law 12), plus the expected and actual shape (track 4 N3).
- **One relation per edge.** A `step_source:` tag separates the three relations on `parent_execution_id`
  (track 3 P4), so ingest derives edges only from real composition.

### R4 — enter forward mode in place, and hand back (a)
- **At the stall, enter forward mode inside the walk,** with the same pool. Emit the route-around record there,
  where `missingTargets` already exist as local state (track 4 N3, §5.2).
  - This replaces the post-walk floor call (`:13540`), gated on a parity battery that runs the baseline first.
  - The REUSE floor (`:13235`) stays until a runner-minted composite exists to replace it.
- **After each forward step, check whether a learned composite or a producer of the target is now in reach**
  (`discover-by-shapes mode:"backward"` on the new pool). The threshold is read from a shape, not the 0.3
  constant (track 4 N4).
  - Re-frame and FEEDBACK-RETRY become "continue forward from what was observed", not restart from an empty pool.
- **This needs agentic-floor step 5's "return pending tool calls" mode** in llm-resolver (a) and the wrapper (b),
  so goal-host owns S5–S6.

### R5 — answer, extract, reuse
- The answer is a `human_presentation` impulse consuming observation ids, judged at full length with the date
  (output-shapes preconditions).
- Extraction comes from the real chain (agentic-floor steps 3–4).
- The ceiling then finds it by shape signature.

### Held behind §9.0 (stated, not a footnote)
- Any **peer** producer in the offer. A tool impulse names its own dispatch address and the dispatcher
  attaches our ApiKey, so a peer can point a tool anywhere and receive our credential (track 1). Peer `mcpTool`
  rows advertise `auth_scheme: none`, and llm-resolver takes the first discovered row.
- Offering **write** shapes or write-bearing activities.
- Remote `activity_execution` as a tool (it also returns no content).
- Per-producer credit (track 1 P5).

## 5. Acceptance

**Preconditions.** Until all hold, every criterion is "not evaluable":
- agentic-floor P0.1–P0.3;
- **P0.4:** §9.0 holds for tool dispatch. Today it fails, so S1 and S3 stay held for peer and write producers.
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

## 6. What the substrate can do itself now ((b)), and what needs you

**(b), each with a class2 falsifier from the track file:**
1. R0: take the search shapes off the deny list, and the catalogue-entries-are-callable row. Cheapest, and it
   makes the loss detectable.
2. R2 search: `activity_search` as the typed union.
3. R2 ranker: `discover-by-shapes` ranks resolver shapes.
4. R3 offer filter (write, re-entry, ancestor).
5. Fix the `activity` resolver (outputs, impulses, tags, cycle chain, budget), or retire it (decision 2).
6. Fix the stale nested-execution test, which conflicts with `8f1343c` (track 3 P5).
7. From agentic-floor: the development-vessel wrapper's transcript forward.

**(a), needing your clearance:** the goal-host halves of R3–R4, and llm-resolver's pending-tool-calls mode.

**Inside the human-surface grant:** unchanged (the best-output run view).

## 7. Gap ledger

| Gap | Action |
|---|---|
| **Missing: the runner capability** | **File once** (R0), consolidating the floor-family gaps. Falsifier: §5 S1–S6. |
| Satisfier re-baseline gap named by goal-host's interlock | **Restore.** Missing from the live store, and R2's posterior term is blocked on it. |
| `orphaned-capability-scan` `META_DENY` | **Remove the exemption** (R0). |
| `keyword_extractor` catalogue entry (opened and closed 09-30) | **Cite** as R0's must-fail control. |
| Failing nested-execution contract test (filed 09-30) | **Fix the test,** not the code (track 3 P5). |
| validator-dispatch 586/586 failures | **Port the template lookup, or retire it** (decision 2). |
| `shape_producer_inventory` always "0 producers" | **New finding** (§9): it reads `vessels` where discovery returns `content.vessels`. |
| agentic-floor and output-shapes ledgers | Stand as written. |

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

## 9. Decisions needed (the user's)

1. **Does forward-in-place replace the post-walk floor?** It would go through the parity battery with the
   baseline run first, using the same go/no-go criterion as agentic-floor decision 1.
2. **The `activity` resolver:** fix it, or retire it along with validator-dispatch.
3. **Concept-db's 9 MCP-format tools:** serve them as pointer shapes, or drop them from the catalogue.
4. **Credit for a nested child when its ancestor reaches.** This is `posterior-update.ts`, an (a) build. Today 0
   of 369 composed children earn anything.
5. **May the runner ever offer write-bearing activities or write shapes?** If so, under what containment, after
   §9.0.
6. **`tool_usage` (0 rows):** give it a writer (R2's search grading), or retire it.

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
