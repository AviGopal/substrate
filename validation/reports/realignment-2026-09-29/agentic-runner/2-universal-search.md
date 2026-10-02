# Track 2: search through one universal tool

2026-10-01 operator date. Live reads ran at about 06:00Z on 10-02 by the container clock. This is a read-only census. Nothing was dispatched, written, restarted or committed. All resolves were reads (`mcpTool`, `activity_search`, `trace_search`, `tool_pattern_search`, `conceptSearch`, `discoverByShapesQuery`, `shape_producer_inventory`, `resolver_schema`, `vesselCapability`). The metabob cockpit was not used. Every call went to `127.0.0.1:18xxx` or through `docker exec substrate-live`.

**Sources for the line numbers:**
- **Live code:** the source in `/vessels/<vessel>/src`.
- **REALIGNMENT:** the `origin/dev` copy, which includes §9.
- **Prior tracks:** [agentic-floor/APPROACH.md](../agentic-floor/APPROACH.md) (APPROACH-F) and [output-shapes/APPROACH.md](../output-shapes/APPROACH.md) (APPROACH-O). They are cited, not repeated.

---

## 0. Corrections to the brief

1. **"The only `mcpTool` consumer is development-vessel orphaned-capability-scan" is wrong. That file excludes `mcpTool`; it does not consume it.**
   - `orphaned-capability-scan.ts:129-130` puts `mcpTool`, `discoverByShapesQuery`, `activity_search`, `trace_search` and `tool_pattern_search` in its deny set, labelled "activity-api learning / read shapes (owned, not outward capability)".
   - The exclusion follows `openspec/changes/2026-06-23-demand-driven-orphan-capability-detection/design.md:37`.
   - **Consequence:** no live source calls `activity_search`, `trace_search` or `tool_pattern_search`, and none consumes `mcpTool` as a client. The detector built to notice exactly that ignores these shapes on purpose. No orphan gap has ever been filed for any of them.
2. **The "07-26 activity_search note" is a code comment, not a memory note.**
   - It is in activity-api `routes/impulses.ts:3847`, added by `c5fd43a` (07-30, Substrate Autonomous): "it had a working resolver case below but zero callers because nothing advertised it".
   - No operator memory file contains it.
3. **Minibob was retired in three stages.**
   - **05-24:** the execution engine was deleted (`e534a72` "strip minibob to CLI wrapper — delete execution engine, delegate to goal-host-vessel" and `814d215`), and the container unit was removed (super-repo `57d74520`).
   - **06-26:** the submodule gitlink was dropped (`b49942df`).
   - **08-01:** memory records it as "removed" (`feedback-repo-hygiene-target-state.md:18`).
   - Every search *consumer* died on 05-24.

---

## 1. Prior art (first, as required)

### 1.1 Dated history

| Date | What was built | Who called it | What happened |
|---|---|---|---|
| 03-17 / 03-18 | minibob `search_activities` LLM tool (`a09d9cd`), wired through `mcp-activity-bridge.ts` (`7e6ceb4`) | minibob's LLM loop. Its system prompt said "call search_activities() first" (`activity.ts:7258-7284`). | It was a **category listing**, `GET /v2/activities/templates?category=&limit=50`, not a search. It returned metadata only and fell back to embedded templates. Deleted with the engine on 05-24. activity-api `ribosome.ts:171` still lists `analyzeTools = ['search_activities','goal']`, a fossil reference. |
| 04-24 / 04-26 | activity-api `POST /v2/activities/discover-by-shapes` (`405952a`); the `discoverByShapesQuery` shape (`b8ea00a`) | Walk producer picks; the validator-dispatch template | **Live.** It is the only surface in this inventory with real volume (§2). |
| 04-26 | The `mcpTool` "tools as impulses" bridge. Producers: concept-db `28bd17d`, activity-api `7d3dad1` (empty list). Consumer: minibob `discovered-tools.ts` `getDiscoveredToolsForTask` (`e05ecbd`), local bridge `44566da` (04-28). | minibob only. It fanned out to *every* `mcpTool` producer through discovery, ranked the results, kept the top 20 and merged them into the LLM tool list per task. | The consumer was deleted on 05-24. The producers stayed. |
| 04-30 / 05-01 | The minibob improviser (`193956f`). The improvise template `gather_context` task (`5178b17`) iterates `activity_search`, `trace_search` and `tool_pattern_search` and produces `gather_context_result`. The next LLM task may emit `DISPATCH_ACTIVITY: <id>`. activity-api added the three resolvers (`15bda50`, 05-01). | The improvise template | The **gradable form** existed: search was a template task whose output impulse a later task consumed, and could dispatch an activity found by search. The template, its parser and `gather_context_result` were deleted on 05-24 (`814d215`). No copy exists in ias-executor-ts, activity-api or goal-host. openspec `2026-04-26-impulse-activity-loop/design.md:301,1368` (F-53) records that the searches "returned ranked results when called directly". The goal failures then came from an activity-api connection storm, not from search. |
| 05-27 | Spec `docs/specs/discovery-to-tools-bridge.md` ("draft, implementation pending"). It was archived the same day (`4167ba2a`) and deleted with the archive (`d1e60e40`, 08-02). Readable with `git show d1e60e40^:docs/archive/2026-05-27/discovery-to-tools-bridge.md`. | The spec | It chose tools as `mcpTool` impulses with a context-scored fan-out, and rejected eager loading of all tools. Its own "Relationship to impulse-write resolver" section prefers `*_write` impulse shapes over a parallel tool catalogue. The only consumer it specified was minibob's. |
| 06-25 | goal-host `fetchKnownShapes` plus `goal-target-inference.ts` (`f85a6d5`); peer union `a289eff` (07-02); learned-deliverable union `6082c2e` + activity-api `2c91aaf` (07-31) | goal-host inference | **Live, names only.** It is the fleet's only vocabulary union, it lives in process inside goal-host `index.ts`, and it is not a shape. |
| 06-28 | Discovery `/registry/shape-descriptions` (`1da5b87`, `b123b8e`), the auto-describe tick (`8edd8619`), and planner seeding (dev-vessel `adb2a08c`: "planner composes from ALL advertised resolver descriptions") | dev-vessel `author-composed-capability.ts:160`, `gap-to-feature.ts`. **goal-host: 0 reads.** | Live, volatile and partly confabulated (§3). REALIGNMENT §2.0 and §2.0b record that "inference does not read it". |
| 07-10 | Operator directive (memory `feedback-reach-is-mechanism-correctness-not-a-gamed-metric.md:15`): tools on every LLM path, "ideally tools-as-impulses via the mcpTool bridge … + input schemas from resolver_schema, self-updating — not a hardcoded DEFAULT_LLM_TOOLS". | — | The opposite landed. dev-vessel `DEFAULT_LLM_TOOLS` (`ff3d5d58`) and goal-host `UNIVERSAL_READ_TOOLS` (`1cf0b96`, 07-11, substrate-authored) are five hard-coded literals (agentic-floor E §1b). |
| 07-30 | `c5fd43a`: `activity_search` advertised as an `mcpTool` catalogue entry | Nobody. The only `mcpTool` client had been gone for two months. | It fixed the producer side, which was never where the break was. |
| 09-14 → 09-30 | Autonomous `1f7ac34` added an unservable `keyword_extractor` `mcpTool` entry. Operator-dictated `3f62a22` removed it (gap `failing-test-activity-api-impulses-mcptool-advertises-keyword-extractor-it-cannot-serve`, closed 09-30). | — | Verified live: activity-api's catalogue now holds only `activity_search`. The catalogue drifted with no consumer to notice. |
| 09-29 → 10-01 | REALIGNMENT §2.0 (the "federated producer-and-vocabulary resolver" row), §2.0b ("inference reads the 312 shape descriptions"), §3.3 (`inferGoalTargetShapes` "must read shape descriptions"); agentic-floor D (:59, :192 "no search tool", :251 "the tool offer is the shapes whose producers are live and whose description and schema are known") | — | Named, not built. Widening the floor's tools is held by §9.0. |

There are **no gaps** whose id or summary mentions `activity_search`, `search_activities`, `tool_pattern_search`, `trace_search`, "tool search" or "capability search" (6,847 gaps scanned).

Adjacent open gaps to **extend, not duplicate**:
- `shape-descriptions-do-not-name-the-fields-their-answers-carry` (10-01, edit_site discovery);
- `falsifier-classifier-reads-a-filesystem-vocabulary-while-the-judge-reads-discovery`;
- `lesson-failure-crediting-posts-to-a-404-address…` (the compose_lesson conceptSearch path; about 20 `route-edit-*` descendants, none closed);
- `discovery-lookup-copies-must-migrate-onto-the-typed-ias-seam`;
- the `vessel-demand-discoverByShapesQuery-*` family, which was expired, not repaired.

### 1.2 Minibob behaviour, and what happened to each part

| Minibob behaviour | Status | Evidence |
|---|---|---|
| A search tool in the LLM tool list (`search_activities`) | **Dropped.** It was a category listing anyway. | e534a72; `tools.ts:698` defined at the tip, with the callback unwired |
| Per-task discovered tools (`mcpTool` fan-out → rank → merge) | **Producers ported and live; consumer dropped** | §2 row `mcpTool` |
| Search as a *traced template step* consumed by the next step (`gather_context` → `gather_context_result` → LLM → `DISPATCH_ACTIVITY`) | **Dropped.** This is the gradable form the brief asks for. | 814d215 |
| The three search resolvers | **Ported (activity-api) and live, with no callers.** One of them (`tool_pattern_search`) reads an empty store. | §2 |
| Activity dispatch by id from a search result | **Dropped from the runner.** ias-executor's `compose` resolver exists (track 3). | — |

### 1.3 Why it didn't hold (the §2.0 recurrence, exactly)

1. Search was built on the **producer side three times**: the 05-01 resolvers, the 04-26 `mcpTool` producers, and the 07-30 catalogue entry. The **consumer** lived in one engine, and that engine was deleted. Nobody re-homed the consumer when execution moved to goal-host.
2. The fix of 07-30 diagnosed "nothing advertised it". The true cause was "nothing *reads* the advertisement". Advertising to a client that no longer runs is a hollow write (memory `hollow_write`, 09-15).
3. The detector for this class (orphaned-capability-scan) deny-lists these shapes. It is a silent skip, which reads as a pass.
4. The live floor's tool list was hard-coded against the 07-10 directive. Searching is meaningless when the loop cannot call what it finds (§4).

---

## 2. Inventory of search surfaces (live, read-only)

Probes were sent through discovery `POST :18100/resolve` unless a row says otherwise. The journal window is activity-api from 09-26T14:51Z, which is where its journal starts, to the time of reading. **My own probes are subtracted from the call counts.**

| Surface | Shape → producer | Request → response | Reachable via discovery today | Result quality on realistic queries | Callers (code / journal) |
|---|---|---|---|---|---|
| `activity_search` | `activity_search` → activity-api (`impulses.ts:4075`) | `{query, limit?, output_shapes?, min_score?}` → `activity_search_result` `{matches:[{template_id, name, description(200), tags, output_shapes, metrics, score}]}`. **No `input_shapes`**, so a caller cannot bind or compose from a result. **No `resolver_schema`** (activity-api answers `use_vessel_discovery`); the only schema for it is the `mcpTool` entry's `input_schema`. | Yes (200) | **Poor.** "news headlines today" returned 5/5 `gap-closing:*` debris whose output is `patch_proposal`. "current date" returned Obsidian screen analysis plus a **retired** row (`proposed_pattern_authored_operator_goal_current_work_status`, `retired:true`; n=1 seen, no rate claimed). "search the web and summarize results" returned `learned-composition-websearchresult-to-filecontent` first, with junk inputs `[activity_template, goal, source_code]`. **`metrics` was null on 14/14 hits**, so results carry no posterior. All 3 queries ran `via fts`: the dense path logs `no embedding provider configured`. It returns activities only, never resolvers, so `web_search` itself can never appear. | **Code: 0 non-test callers.** Journal: 9 resolves (12 minus my 3), all walk satisfiers. goal-host logged, as satisfier or executor: DISHONEST empty body 3, "succeeded after arg-correction" 4, "no command arg" 4. In the 09-27 example the request was a gap id (`db_performance_slow_queries…`), not a capability query. Trace store: `satisfier:activity_search` has 2 rows, both 07-14, out of 565 retained satisfier rows. |
| `trace_search` | activity-api (`:4181`) | `{query, limit≤25, success_only=true, since=30d, activity_id?}` → `{traces:[…]}`. Matching is `string::contains(activity_id, query)`. | Yes | **Structurally empty for natural language.** "news headlines today" and "web" returned 0. Positive control: an empty query with `success_only:false` returned 2. | Code 0. Journal 54 (57 minus my 3), all satisfiers. goal-host: DISHONEST 17, arg-corrected 13, "no command arg" 18, one "would be PROVEN-BAD". The walk pulls it in as an **inferred target with synthesized arguments**; nothing is using it as a search. One extracted template (`learned-satisfier-source-code`) carries a `trace_search` task. |
| `tool_pattern_search` | activity-api (`:4320`) | `{tools?, query?, min_success_rate=.5, min_sample_size=3}` → `{patterns:[…]}` | Yes | **Dead store.** It returned 0 even with `min_sample_size:0, min_success_rate:0`. `SELECT count() FROM tool_argument_pattern GROUP ALL` and the same statement for `tool_usage` both return 0. Positive control, with the identical statement on `activity`: 4,026. A writer exists (ias-executor `learning-signal-writer.ts:143`), but the table is empty; its retention was not examined. | Code 0. Journal 0 (all 3 were my probes). |
| `mcpTool` | activity-api (1 entry: `activity_search`) **and** concept-db (9 entries) | `{context:{task_description, goal_keywords, input_shapes, output_shapes}}` → a list of `{tool_name, description, input_schema, resolve_endpoint, resolve_request_format, relevance_score}` | **Partly.** Discovery `/resolve` forwards to **one** producer (`index.ts:206-260`, first policy owner or first direct row), and it chose concept-db. So **`activity_search` is unreachable as an `mcpTool` through discovery.** The union required client fan-out, which only minibob did. | **Uninformative.** Every tool scored a flat 0.15 for "news headlines today" and "current date"; 0.2 to 0.4 only when the query contains catalogue words ("activity", "search"). concept-db's `tool_name`s (`concept_search`, `concept_create`, …) **are not shape names** and use `resolve_request_format: "mcp-tool"` at `/mcp/tools/call`. llm-resolver `dispatchTool` resolves a tool by `vesselCapability` *shape*, so they cannot be called from the live tool loop. 5/9 are writes (`concept_create`, `concept_link`, `concept_record_usage`, `concept_sequence_record`, `concept_upsert_by_signature`). Discovery's learned description of `mcpTool` is "use for goals requiring **molecular computation**". | Code 0 client callers (the `workbench` UI only filters on it). Journal: 3 resolves (7 minus my 4). |
| `discoverByShapesQuery` / REST `discover-by-shapes`; dev-vessel `activity_discover_by_shapes` | activity-api (`:3952`, `services/discover-by-shapes.ts`); the dev-vessel wrapper | `{required_shapes, mode: forward (producers) \| backward (consumers) \| candidates_with_scores, output_shapes?, signature?, completion_shapes?}` → `{activities:[…, input_schema.required_shapes, sampled_score]}` | Yes | **This is a selection primitive, not a search.** It is keyed on exact shape names, and the caller must already know the shape. It covers activities only: `forward webSearchResult` returned 4 (with Thompson `sampled_score`), but `forward web_search`, `news`, `human_presentation` and `goal_answer` each returned 0, although local-tools serves `web_search`. | **The one surface with real callers.** Journal: 21,798 resolves since 09-26 (the validator-dispatch template). Plus the goal-host walk's direct REST calls (`index.ts:5985`, `:10263`, `:10319`, `:10449`, `:10653`) and dev-vessel `gap-lifecycle-scan.ts`, `reachability-gap-repair.ts`, `failure-mode-matrix-score.ts`, `consumer-productivity-audit.ts`. |
| Registry shapes and shape descriptions | discovery `GET /registry/shapes`, `GET /registry/shape-descriptions` (not shapes; REST) | → `{shapes:[407]}`; `{shape_descriptions:{…}}` | REST only (discovery is excluded) | **Volatile.** 286/407 described at my read, against 56/407 on 10-01 (APPROACH-O) and 312/405 on 09-29. Descriptions live in process memory and are refilled by the tick (APPROACH-O T3 §1.1). **Confabulated:** `mcpTool` "molecular computation"; `credit_primed_concepts` "credit scoring … financial". `concept_search` is not a registry shape at all (the shape is `conceptSearch`). No time or date shape exists (`currentTimeReport`, `current_time` and `date` are all absent). | Readers: dev-vessel `author-composed-capability.ts:160` and `gap-to-feature.ts`. **goal-host: 0 reads.** `fetchKnownShapes` (`index.ts:5724`) reads `/registry/shapes` names plus peers plus `/deliverable-shapes`, and has 2 callers (`:5836` gap canonicalisation, `:12307` inference). |
| `conceptSearch` (impulse) / `concept_search` (MCP tool) / `compose_lesson` | concept-db `impulses.ts:516`; MCP `tools/definitions.ts:139`; `compose_lesson` is a concept `source_type`, not a resolver | `{query, source_type?, shape?, min_relevance?, limit}` → concept rows | Yes | **Lexical, not about capabilities.** "news headlines today" returned "Hello, How are you doing today?", "What day is it?" and a `missing_news_capability_gap` concept. "current date" returned Obsidian command concepts. `source_type:"compose_lesson"` returns 34 lessons, all code-edit drafter lessons. With the query "search the web news" it returns 0. dev-vessel `concept_select_for_prompt` for the news query returned "Before Push" (`vessel_construction_pattern`). | Code: dev-vessel `feature-compose.ts:3626` (flat body, possibly malformed, unverified) and `:3920`, `chain-fetch-failure-scan`, `stale-pointer-emit`, `learning-signal-health-observer`, plus many REST `/concepts/search` callers (boredom, activity-api prior-seed, goal-host walk consult). Journal: goal-host logged one `executor "conceptSearch"` misuse. |
| metabob `search_codebase` | Operator MCP cockpit, not a substrate shape (`metabob-cloud-dashboard/src/data/mcp-catalog.ts:173`) | `{query}` → CPG components and analysis results | **No.** The runner cannot reach it. | n/a. The substrate's analogue, `code_search` (local-tools), has the open gap `orphaned-capability-code_search` ("invoked by 0", since 09-26). | Operator-only. |
| minibob `search_activities` | gone | — | — | — | — |

**Reading of the table.**
- The fleet has five lookups and no search: three resolvers with no callers, one exact-name selector with real callers, and a names-only vocabulary inside goal-host.
- None of them returns *both* activities and resolver shapes.
- None returns an item the runner can call next with its input contract: `activity_search` omits `input_shapes`; `discoverByShapesQuery` has them but needs the name up front.
- None feeds a grade back.

---

## 3. Freshness and quality preconditions

| Precondition | Today | Builder |
|---|---|---|
| **Descriptions are durable and checked** | Volatile (286 / 56 / 312) and in process memory; `_write` verbs are skipped; foreign-domain confabulations exist (§2). This is already APPROACH-O step 5 and T3 P5, and the open gap `shape-descriptions-do-not-name-the-fields…`. **Extend that gap** with: persistence across restart; a check that a learned description is refused when it shares no stem with the shape name or the producing vessel's own advertised vocabulary (must-fail: `mcpTool` "molecular", `credit_primed_concepts` "financial"); and the output-field list. | (a): discovery `registry.ts`, `scripts/substrate/auto-describe-resolvers.ts` |
| **Activity search results exclude non-capabilities** | 820 of 2,794 non-retired activity rows (29%) are `gap-closing:*` drafts whose output is `patch_proposal`, and they took 5/5 hits for "news headlines today". FTS returned a retired row. | (b): activity-api `db/paradigm.ts` `queryActivitiesByFTS` (retired filter, as the dense path at `:1637` already has) and `routes/impulses.ts` (exclude drafts and `proposed_*`, or demote them by category) |
| **Results carry a posterior and an input contract** | `metrics` null on 14/14 hits; no `input_shapes`. `discover-by-shapes.ts` already joins `variant_performance_metrics` and samples. | (b): reuse that join; do not write a second one |
| **The dense path** | Dead: `no embedding provider configured` on every call. The count of activity rows with embeddings came back 0, but that field name is unverified. | Out of scope. State it as a fact, and do not cite "semantic search" until it holds. |
| **Activity descriptions** | 37 of 2,794 non-retired rows have a description under 20 chars. Coverage is not the problem; the noise from debris rows is. | — |
| **`trace_search` semantics** | Substring on `activity_id`, a 30-day default against a ~3-day hot window, `success_only` defaults to true. This is a design limit. | Leave it; do not union it into the search until it matches goal text. |

---

## 4. The fact that decides what "universal" can mean

**Inside the live tool loop, a search tool can only inform the model. It cannot extend what the model can call.**
- llm-resolver `dispatchTool` (`src/index.ts:514`) refuses any `toolName` not in the request's `offered` set.
- `toolPointer` fixes `pointer.type = toolName`. The closed gap `llm-resolver-tool-dispatch-lets-model-tool-input-override-the-tool-type-bypassing-the-tool-allowlist` made that deliberate.
- So "search → call what you found" in one loop needs one of two things:
  - **(i)** agentic-floor **step 5**: goal-host owns the loop and widens the offer between turns, through `ufResolveUrl` and the §9.0 allowlist;
  - **(ii)** a **two-round floor** after agentic-floor step 1: round 1 offers search, goal-host reads the search result from the forwarded transcript, and round 2 adds the vetted found shapes to `tools`.

  Both widen the tool offer, so both are **held by §9.0** (APPROACH-F decision 2: `web_search` as the one-shape exception).
- The search *read* itself is §9.0-safe:
  - it widens no address;
  - activity-api authenticates;
  - `ufResolveUrl` picks the local non-libp2p row;
  - its results are names and contracts, not grants.

A tool name in both loops **is a shape name**: llm-resolver resolves by `vesselCapability`, and goal-host by `ufResolveUrl(shape)`. So the callable unit of a universal search is the **registry shape** (plus its `resolver_schema`) or the **activity id** (via ias-executor `compose`, track 3). It is not an `mcpTool` entry.

**Why `mcpTool` is not the organ to extend** (law 3 still holds: an existing organ is extended, just not this one):
- discovery resolves it from one producer;
- it scores flat;
- concept-db's entries are uncallable by both loops;
- 5 of its 9 entries are writes;
- its own spec preferred impulse shapes;
- it has had no consumer since 05-24.

Its fate (keep as a fossil, or retire) is a decision for the coordinator (§8).

---

## 5. Proposals

All of these extend existing organs. None needs a new service. Builder labels follow the live `autonomyScope` from the brief. activity-api `routes/impulses.ts`, `db/paradigm.ts` and `services/`, the dev-vessel resolvers outside the excluded list, and ias-executor are (b). goal-host `index.ts`, llm-resolver `index.ts`, discovery and `scripts/substrate` are (a). One change per landing (law 12).

### P1: `activity_search` becomes the kinded union. One shaped read, two readers. (b)

- **Seam:** activity-api `routes/impulses.ts` `case 'activity_search'` (`:4075`), plus a helper in `services/` beside `discover-by-shapes.ts`.
- **Change:** accept `kinds?: ["activity","shape"]` (default both). Union:
  - **activities:** FTS rows with the retired, draft and `proposed_*` filter (§3), with `input_shapes` and the posterior taken from the existing discover-by-shapes join;
  - **registry shapes:** GET discovery `/registry/shape-descriptions` and `/registry/shapes`, scored by the same token scoring over the description. Keep only shapes with a **local, non-libp2p advertiser** (the discovery `vesselCapability` row, i.e. the same rule as `ufResolveUrl`). Keep only read shapes; `*_write` is excluded until §9.0. Each item carries its `resolver_schema` fields when the producer answers `known:true`.
- **Uniform item:** `{kind, id|shape, description, description_source: advertised|learned, input_shapes|input_schema, output_shapes, posterior: {alpha, beta, sampled}|null, local_advertisers}`.
- **Discovery read goes through the typed seam.** Use ias-executor `HttpDiscoveryAdapter.lookup()` (REALIGNMENT §9.1), or the read is acknowledged as raw lookup copy #41 under the open `discovery-lookup-copies-must-migrate-onto-the-typed-ias-seam`. `shape_producer_inventory` (§9) shows what a raw copy costs. Read **one** registry listing per search (cached with a short TTL), never a per-shape `vesselCapability` call (407 calls).
- **Output shape:** `activity_search_result`, unchanged, so existing satisfier traces remain comparable.
- **Same read as §2.0b and §3.3** ("inference reads the descriptions"). goal-host inference can later consume this shape in place of names-only `fetchKnownShapes`. That is (a), and it is **not** proposed here, to keep one change per landing. **Already in REALIGNMENT §2.0 / §2.0b and APPROACH-O step 5 as "inference reads descriptions"; new as one shaped read shared by the runner's search and inference.**
- **Gate:** deterministic, with no LLM in the ranking.
- **Controls:**
  - **Must-fail today:** `{query:"search the web for news"}` returns no item with `shape: "web_search"`.
  - **Positive:** after the change, `web_search` is in the top 5, with `local_advertisers ≥ 1`.
  - **Must-fail:**
    - a retired id never appears (fixture: `proposed_pattern_authored_operator_goal_current_work_status`);
    - no `gap-closing:*` item whose only output is `patch_proposal` appears;
    - no `*_write` item;
    - no item whose only advertiser is a libp2p row.
  - **Discriminating:** "summarize trace failures" still returns the `traceAggregateReport` shape, which is described and owned locally.
- **Precondition:** descriptions are durable (§3 row 1). Until then, the shape half is "not evaluable", never "met". The activity half can land first.

### P2: the result quality fixes, as independent landings (b)

1. Retired filter in `queryActivitiesByFTS`.
2. Exclude or demote drafts.
3. Add `input_shapes` and the posterior.

Each has the matching must-fail control from P1. These are useful even if P1 waits. **New** (no prior proposal names these defects).

### P3: search is a traced step whose use is graded. Revives the deleted `gather_context` form. Depends on agentic-floor.

- **Seam:** none new. The floor's tool records enter through the walk's satisfier step block (APPROACH-F step 4, goal-host `index.ts:10110-10245`, (a)).
  - A search call becomes a task with output `activity_search_result` and a pool impulse listing the returned ids.
  - The next step's `consumedIds` (APPROACH-F step 3) names the search impulse when the step used a returned item.
- **Grade:** deterministic, computed from the ledger.
  - `hit_used`: a returned id or shape is the producer of the next resolved step.
  - `hit_used_and_reached`: the chain is `reached` and `grounded`.
  - Recorded as relevance on the search-result impulse through the existing advertised `impulseRelevance_write` ("relevance scores grade impulses", CLAUDE.md).
  - Per-item credit flows through normal selection grading of the item actually used. **No new table.**
- **Ranking learns:** P1's score adds the item's (`hit_used_and_reached` / `hit_used`) Beta mean, read at use time (law 1). This is a posterior on the search, not a constant.
- **Controls:**
  - **Positive:** a fixture run that searches, then calls the returned `web_search`, then reaches. The search impulse's relevance rises.
  - **Must-fail:** a search whose results were not consumed leaves relevance unchanged.
  - **Must-fail:** a search inside an unreached chain does not raise it.
- **Not evaluable until** APPROACH-F P0.1/P0.2: calls are visible, and `consumedIds` exist.
- **Already in APPROACH-F steps 3–4 as mechanism; new as the search grade.**

### P4: feed `tool_pattern_search` from the visible transcript. (b) after APPROACH-F step 1

- **Seam:** ias-executor `resolvers/learning-signal-writer.ts:143` (the existing `tool_argument_pattern` writer) or the dev-vessel wrapper `llm-completion-dispatch.ts`. Each executed transcript entry with a successful result emits `toolArgumentPattern_write`.
- **Controls:**
  - **Must-fail today:** `tool_argument_pattern` has 0 rows.
  - **Positive:** after N floor calls, `tool_pattern_search {tools:["web_search"], min_sample_size:1}` returns the argument skeleton that succeeded. That fixes the refused-first-payload class from APPROACH-O T2 P3 *by learning* rather than by a hand-written schema, which matters while decision 2 is open.
- **Guard (APPROACH-F step 1 trap 1):** N transcript entries yield N pattern writes, not 2N.
- **New** as a feed. The writer is existing prior art; the source is APPROACH-F step 1.

### P5: detector, so this class is found without an operator (law 6). (b)

- **Seam:** dev-vessel `resolvers/orphaned-capability-scan.ts:129-130`. Remove `activity_search`, `trace_search`, `tool_pattern_search` and `mcpTool` from the deny set, so they are scanned like any outward capability.
- **Also:** one §2.1 evaluator row: "every advertised read/search shape has ≥ 1 *non-satisfier* caller in 7 days, or an explicit retire row".
- **Must-fail today:** `activity_search` has 0 code callers and has never had an orphan gap.
- **Positive control:** `discoverByShapesQuery` (21,798 resolves) is not flagged.
- **Discriminating:** a shape reached only through satisfier pull-ins with synthesized arguments (`trace_search`: 17 DISHONEST, 18 "no command arg") counts as **uncalled**, not as used.
- **Already in REALIGNMENT §2.1 (rows with must-fail controls); new as this row.**

### P6: the runner's offer. (a), held by §9.0 except the read

- **Now (a): a candidate *second* one-shape exception, for the coordinator.** Add the P1 search as one read tool on the floor's offer (goal-host `UNIVERSAL_READ_TOOLS` / `:5392`, after APPROACH-F step 1).
  - APPROACH-F step 5 holds any widening of the floor's tools, so this needs the same decision as `web_search`.
  - The contrast that makes it cheaper: §9.0's own measurement finds that only discovery and activity-api authenticate. A search served by activity-api adds no unauthenticated route; `web_search`, served by local-tools, does.
  - The result returns names and contracts, not grants. Even before the runner can call what it finds, the model can name existing capabilities in its answer and route-around record (§2.0b emitter), which is evidence for the encapsulation counter.
- **Held:** widening `tools` with found shapes, via the two-round floor (§4 ii) or step 5 (§4 i). The admission rule for a found shape:
  - it has a local advertiser;
  - it is a read verb;
  - it has a durable, checked description;
  - it has `resolver_schema` `known:true`, or ≥ 1 learned argument pattern (P4).
  This is agentic-floor D:251's rule, made deterministic.
- **Activities found by search** are dispatched through ias-executor `compose` (track 3), not as tools.
- **Already in** agentic-floor D:251 and APPROACH-F decision 2. **New:** search as the shape that makes the offer, and the deterministic admission rule above.

---

## 6. Order

**P2 → P5 → P1 (activity half) → description durability (§3, (a)) → P1 (shape half) → [APPROACH-F steps 1, 3, 4] → P4, P3, P6-now → [§9.0 + decision] → P6-held.**

- P2 and P5 are (b), small, and need nothing else.
- Nothing in P3 or P6 counts as "met" before APPROACH-F P0.1 and P0.2.

## 7. Gap ledger (consolidate, do not mint)

| Gap | Action |
|---|---|
| `shape-descriptions-do-not-name-the-fields-their-answers-carry` | **Extend** with persistence, the confabulation refusal (must-fail: `mcpTool` "molecular") and the volatility series 312 → 56 → 286. |
| `floor-tools-counter-reads-zero-…` | **Cite** as P3/P4/P6's precondition. |
| `orphaned-capability-code_search` and siblings | **Cite** as evidence that the read surfaces have no caller. They close when P6 offers search, or by retire rows. |
| `lesson-failure-crediting-posts-to-a-404-address…` (+ descendants) | **Out of scope.** It belongs to the compose_lesson lane; note that the dev-vessel `feature-compose.ts:3626` flat-body read may be the same defect (unverified). |
| *Candidate, not filed* | `shape_producer_inventory` always reports 0 producers (§9). Fold it into `discovery-lookup-copies-must-migrate-onto-the-typed-ias-seam`, since it is the same envelope class. |
| *Candidate, not filed* | The orphan scan deny-lists the search shapes (P5). |

## 8. Decisions for the user or coordinator

1. **`mcpTool`:** retire it as a fossil (no consumer since 05-24; uncallable entries; 5/9 writes), or keep it as an operator-facing catalogue. Do not extend it as the runner's search (§4).
2. **P1's home:** activity-api (recommended: (b), and it already calls discovery), or discovery itself ((a), the data owner).
3. **The two-round floor (§4 ii) versus waiting for step 5**, for the held half of P6. Both sit behind §9.0 and APPROACH-F decision 2.

## 9. Findings for the coordinator (not proposals)

- **`shape_producer_inventory` always answers "0 producers".**
  - activity-api `routes/impulses.ts:1418` reads `spiData.vessels`. Discovery returns `{content:{vessels}}`.
  - Probe result: `web_search` → `0 producer(s) … no_producers`.
  - **Positive control through the same discovery `/resolve`:** `vesselCapability web_search` → 5 rows.
  - Its own header names its consumer: slot-binding's `check_discovery_for_producer`, which dispatches `forge_vessel_for_shape` when `count === 0`. Whether that consumer still runs was not checked.
  - It is the same envelope-divergence class that the `ufBuildWriteTool` comment in goal-host documents.
- **Search shapes are being used as inferred *targets*.** The walk resolves `trace_search` and `activity_search` with synthesized, unrelated arguments (a gap id as the query): 17 + 3 DISHONEST bodies and 18 + 4 "no command arg" since 09-26. That is noise in satisfier credit and in extraction (`learned-satisfier-source-code` carries a `trace_search` task).
- **activity-api's own `mcpTool` catalogue is invisible through discovery,** because discovery forwards `mcpTool` to concept-db only. Any future consumer would have to fan out on the client side.

## 10. Verification status

- Every proposal is **specified, not run**.
- The probes in §2 were run live: resolves, discovery reads, SurrealDB counts with positive controls, and journal counts with my probes subtracted.
- The subagent history (git pickaxe across all submodules including `deployment/vessels/minibob`, and a gap-store scan) is cited with hashes. It was not independently re-run line by line.
- **Unverified:**
  - the field name behind the "0 activity embeddings" count;
  - the feature-compose flat-body defect;
  - whether slot-binding still calls `shape_producer_inventory`.
