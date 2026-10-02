# Agentic runner, track 1: tools available for selection via the relevancy of their resolvers

2026-10-01 (operator local); live reads taken 2026-10-02 05:55–06:12Z by the container clock. Read-only.
No dispatches, no writes, no restarts. The only POSTs were read-only resolves: discovery `vesselCapability`
and `mcpTool`; `mcpTool` against concept-db and activity-api; one `activity_search`; and one `memoryNote`
read. SurrealDB was read with `SELECT` only.

**Sources.**
- Live source is `/vessels/<vessel>/src` in `substrate-live`. Line numbers are live.
  - The local activity-api clone lags `origin/dev`: it lacks `3f62a22`.
  - The local concept-db clone is behind too: its `case 'mcpTool'` is at `:665`, live it is at `:679`.
- The minibob history is `repos/deployment/vessels/minibob`, its own git repo. `origin/dev` contains the 05-24 strip, but the working tree checked out locally predates it.
- The spec `docs/specs/discovery-to-tools-bridge.md` is read from super-repo `8a6bbcaa` (04-25). It was archived 05-27 (`4167ba2a`) and deleted 08-02 (`d1e60e40`). The code still cites it at four sites.
- REALIGNMENT is read from `origin/dev`, including §9.
- Prior tracks are cited, not redone: `agentic-floor/` APPROACH and A–E, and `output-shapes/` APPROACH and 1–5.

---

## 0. Corrections to the shared brief

1. **`mcpTool` has no consumer.** The brief named development-vessel `orphaned-capability-scan.ts` as the only consumer. It is not one: `mcpTool` sits in that scan's `META_DENY` list (`:129`), which exempts internal shapes from orphan flagging.
   - A grep of every `/vessels/*/src` (non-test `.ts`/`.json`) finds `mcpTool` only in the two producers and that deny list.
   - goal-host, llm-resolver, ias-executor and local-tools contain the string zero times.
   - **Live consumers: 0.**
2. **activity-api advertises one tool, not two.** The `keyword_extractor` entry that substrate-authored `1f7ac34` added on 09-14 was removed by substrate-authored `3f62a22` on 09-30. A failing test caught it: gap `failing-test-activity-api-impulses-mcptool-advertises-keyword-extractor-it-cannot-serve`, closed 09-30 19:32Z.
3. **Discovery does not fan out.** A discovery `/resolve` with `pointer.type:"mcpTool"` returns **only concept-db's 9 tools** (read 06:11Z). Discovery picks one producer: a policy owner first, else the first non-libp2p row (`discovery-vessel/src/index.ts:206-240`). The only fan-out over `mcpTool` producers ever built was minibob's consumer.

---

## 1. Prior art (first, as required)

### 1.1 Timeline

| Date | Commit / record | What happened | Held? |
|---|---|---|---|
| 04-25 | super `9f91c137`, reworked `8a6bbcaa` | Spec "Discovery-to-Tools Bridge". A tool is an impulse of shape `mcpTool`. The consumer asks discovery who advertises `mcpTool`, fans the task context out to each, and merges and ranks. The vessel-side score is `0.4·shape + 0.3·keyword + 0.3·EMA`. The consumer-side score is `vessel_score + global_ema(tool,vessel) + thompson(template,tool)`. Feedback goes through `impulseRelevance_write` after each run. The rework commit records the user's correction: reuse "impulses with metadata, shape-driven discovery, Thompson Sampling, EMA relevance", and build no parallel registry. | The spec held as text until 08-02. |
| 04-26 | minibob `e05ecbd` | Consumer `discovered-tools.ts` (969 lines) built. `buildMcpToolPointer` gathers the input/output shapes, deterministic `tokenizeKeywords` goal keywords, the task description, the task id, the prior template id, and `limit` 20. `getDiscoveredToolsForTask` asks discovery for `mcpTool` advertisers, fans out with `Promise.allSettled`, merges, dedups by (vessel, name) and then by name, sorts by the **producer-reported** `relevance_score`, caps at `limit`, and caches 30 minutes per (activity, task, context hash). `makeDispatchHandler` synthesizes handlers. It was wired at `activity.ts:5568` into every task's LLM tool list. | Dead on 05-24. |
| 04-26 | concept-db `28bd17d`, activity-api `7d3dad1` | The producers. concept-db scores its 9 MCP tools. activity-api returned an empty list. | Both are still live. |
| 04-28 | minibob `44566da`, deployment `6f7b334` | Local bridge: workspace tools registered as local `mcpTool` providers. Deployed to canary. | **No evidence was found that the path ever ran live** (no trace or report cites a `[DiscoveredTools]` resolution). |
| 05-24 | minibob `e534a72`, `814d215` | "strip minibob to CLI wrapper … delegate to goal-host-vessel". `activity.ts`, the improviser and `mcp.ts` were deleted. `discovered-tools.ts` survived with **no caller**: on `origin/dev` the only reference left is `workspace-vessel.ts:186`, which registers local tools nobody reads. The bridge was not ported to goal-host or llm-resolver. | **This is where it stopped holding.** |
| 05-17 | openspec `2026-05-17-shape-dispatch-agreement/design.md:31,152` | Notes `mcpTool` as an intentional multi-advertiser shape. | — |
| 06-23 | openspec `…orphan-capability-detection/design.md:37` | Puts `mcpTool` on the orphan scan's deny list as internal. | This is the "consumer" the brief miscounted. |
| 07-10 | operator directive (memory `feedback-reach-is-mechanism-correctness-not-a-gamed-metric.md`) | "tool provision to the LLM — properly, all paths, **tools-as-impulses via the `mcpTool` discovery-to-tools bridge** + input schemas from `resolver_schema`, self-updating — **not a hardcoded DEFAULT_LLM_TOOLS**." | The directive was not followed (next row). |
| 07-11 | goal-host `1cf0b96` (substrate-authored, gap `route-edit-38699a72`) | `UNIVERSAL_READ_TOOLS` born as **four hand-written literals**; `substrateGap` was added later. | The literals are still live (`index.ts:4566-4572`). |
| 07-23 | goal-host `43247db` (operator session) | Made the floor a real dispatch → execute → observe loop over that hand list plus `_write` targets. | The loop holds. The tool list is still hand-written. |
| 07-27 | goal-host `559a55d` | Trusts the dev-vessel wrapper's internal loop (agentic-floor A). | — |
| 07-30 | activity-api `c5fd43a` (substrate-authored) | Added the `activity_search` catalog entry ("it had a working resolver … but zero callers because nothing advertised it"), using the `pointer` request format against `/v2/impulses/resolve`. This collapses the second vocabulary, as the spec predicted. | It is still advertised to **no consumer**. |
| 09-14 | activity-api `1f7ac34` (substrate-authored) | Added a `keyword_extractor` entry that activity-api cannot serve. | Hollow for 16 days. |
| 09-30 | activity-api `3f62a22` (substrate-authored) | Removed it after a failing test. | The test gate worked. The hollow entry lived 16 days because nothing consumes the catalog. |

**REALIGNMENT does not mention `mcpTool`.** It is absent from §3.3 (core toolset), §3.4 (revive-general) and §4 (fossils). The agentic-floor and output-shapes tracks don't mention it either; they reason about `resolver_schema` and hand-written lists only. That omission is the main prior-art finding of this track.

### 1.2 Why it did not hold

The minibob engine was retired as a whole, and the port enumerated execution paths, not organs:
- `GOAL_RUNTIME` was replaced by the HTTP delegation to goal-host (`67e3329`, `a23db75`).
- The per-task tool resolution had lived inside `activity.ts`'s LLM-task path. goal-host had no equivalent call site, so the bridge lost its only caller without a record.

Seven weeks later the floor was rebuilt from scratch, and both builders took the cheaper route:
- **07-11, the substrate's own compose:** wrote four literals into goal-host.
- **07-23, the operator session:** made the loop real. The commit body is about grounding (the "REACHED after 0 tool calls" hollow-green) and never mentions tool provision. The 07-10 directive was 13 days old.

No commit, report or gap records a decision against `mcpTool`. It was not rejected; it was **not found**, which is REALIGNMENT §2.0's pattern: "built and validated once, then no caller", and the next attempt mints a parallel instrument.

### 1.3 Behaviour classification (minibob → today)

| minibob behaviour | Status today |
|---|---|
| Per-task `mcpTool` pointer built from task shapes + keywords + description | **Dropped** 05-24 (no caller). |
| Fan-out to every advertiser, merge and dedup | **Dropped**. Discovery `/resolve` picks one producer (§0.3). |
| Vessel-side scoring (keyword + shape token overlap + EMA prior) | **Ported and live, but inert**: two producers, no reader. |
| Consumer-side `global_ema + thompson(template, tool)` | **Never built**, even in minibob. The consumer sorted by the producer's self-reported score. |
| `impulseRelevance_write` feedback after each tool call (spec step 8) | **Never built.** No such call in `discovered-tools.ts` or `activity.ts` at any revision before `814d215`. |
| Dispatch via the tool impulse's own `vessel_endpoint` + `/mcp/tools/call` | **Dropped**, and **must not be revived as written** (§4, §9.0). |
| Improviser's tools (`createToolHandlers` + `activity` tool) | Static, built in `improviser.ts:150-157`. **The improviser never used the bridge either.** |

---

## 2. Q1: the `mcpTool` contract today, end to end

### 2.1 Producers (live)

| Advertiser (discovery row, read 06:03Z) | Origin | Auth | Catalog |
|---|---|---|---|
| `concept-db-local`, `127.0.0.1:8260` | `local` | ApiKey | 9 MCP tools from `conceptTools`. Format `mcp-tool`, endpoint `/mcp/tools/call`. |
| `activity-api-local`, `127.0.0.1:8080` | `local` | ApiKey | 1 tool, `activity_search`. Format `pointer`, endpoint `/v2/impulses/resolve`. |
| `concept-db-local@syzygy-hub` | `peer:http://syzygy.host:18100`, libp2p | **none** | The peer's copy. |
| `activity-api-local@syzygy-hub` | `peer:…`, libp2p | **none** | The peer's copy. |

**Scoring.**
- **concept-db** (`routes/impulses.ts:196-261`, live). `score = 0.4·shape + 0.3·keyword + 0.3·relevanceEmaForTool()`.
  - The shape term is token overlap between the requested shape names and the tool's name and description; tools declare no shapes.
  - `relevanceEmaForTool` **returns the constant 0.5** (`:196-197`), with `TODO(discovery-to-tools-bridge): wire to per-tool EMA once a tool_usage table … exists`.
  - The score is computed per call and nothing is stored.
- **activity-api** (`routes/impulses.ts:3855`, live). `0.3·keyword + 0.15`. The keyword term counts query tokens that hit an 11-word hand list (`activity`, `search`, `template`, …). The EMA is the constant uninformed prior.

**Positive control with a realistic context (the news goal, 06:05Z).** Pointer: keywords news/today/headlines/world/search/latest, the news task description, and output shapes `web_search`/`human_presentation`.

| Producer | Returned (score) |
|---|---|
| concept-db | `concept_search` 0.291 (it matched on the token "search"; `matched_output_shapes:["web_search"]` is a lexical false match), then 8 concept tools at 0.15–0.19 |
| activity-api | `activity_search` 0.177 |

Neither offers anything that retrieves news. `web_search`, `shellResult`, `http_fetch` and the other ~400 advertised shapes are **in no `mcpTool` catalog**. The catalogs are hand lists of MCP tool names, parallel to the shape vocabulary.

### 2.2 Dispatchability

The two live tool executors call a tool by resolving **a shape named after the tool**:
- llm-resolver `dispatchTool` (`index.ts:514-560`): pointer `type = toolName`, POSTed to the URL from `resolveToolEndpoint(toolName)`;
- goal-host `ufExecuteTool` (`index.ts:4689`): `ufResolveUrl(shape)` plus the rawResolve envelope.

So of the 10 live catalog entries:
- **1 is executable:** `activity_search`. Its format is `pointer`, and it is an advertised shape (`activity-api/src/config.ts:386`).
- **9 are not:** concept-db's `mcp-tool` entries. `concept_search` and the others are MCP tool names, not shapes (the registry has `concept_search_by_source` and so on, not `concept_search`), and neither executor speaks `/mcp/tools/call`.

The spec foresaw this: "every tool-that-mutates becomes a `_write` shape and this branch collapses". activity-api's `c5fd43a` is that collapse, applied to one tool.

### 2.3 Is the "per-tool EMA" fed by anything?

**No.** Every candidate store, checked at 06:00Z:
- **No `tool_usage` table.** `concept_usage` is keyed by `concept_id`: 268 rows, 258 `neutral`, 6 `success`, 4 `failure`. Its trace ids look like `mcp_rest_search_*`, which are concept searches, not tool outcomes.
- **No caller,** so there are no tool outcomes to feed back.
- `satisfier:mcpTool` exists in `variant_performance_metrics` (8 executions, last 09-03, α 1.0 / β 2.87). The walk resolved `mcpTool` as a **target shape** 8 times. That is consistent with discovery's learned description of it (next point).
- **Discovery's learned description for `mcpTool` is confabulated:** "produces mcpTool; use for goals requiring molecular computation or specialized tool output" (`/registry/shape-descriptions`, 06:00Z). Rank 0's "inference reads the shape descriptions" would read this.

---

## 3. Q2: signals that could rank a resolver or activity as a tool for a step

Mind the field-name trap: `context_thompson_scores` uses `alpha`/`beta`; `variant_performance_metrics` uses `thompson_alpha`/`thompson_beta`. Real field names were read with `SELECT * … LIMIT 1` before any aggregate.

| Signal | Store / reader | Key | Live population (read 06:00Z) | Per-step rankable? |
|---|---|---|---|---|
| Satisfier posterior per shape | VPM `activity_id = satisfier:<shape>`; read by `thompson_posterior` → goal-host `fetchSatisfierReliability` (`:6166`) | shape | **391** arms; 179 executed in 7d, 47 in 1d. | Per **shape**, not per producer, and not per context. |
| Context-conditional satisfier posterior | CTS `template_id = satisfier:<shape>` | (shape, `context_bucket`) | **828** satisfier rows of 30,840 CTS rows; 11,982 CTS rows updated in 7d; 1,435 rows bucketed as `cluster:sigcl_*`. | **Yes.** This is the only per-step, context-keyed signal. `/v2/activities/recommend` (handler `activities.ts:6126`) already reads CTS by bucket (`:6404-6420`). |
| Activity posterior | VPM (6,772 rows), served by discover-by-shapes, which sorts by `sampled_score` (`services/discover-by-shapes.ts:261-325, 433`) | activity id | Live; the walk uses it every iteration. | Yes, for **activities** (track 3). The candidate set is `activity` rows only; vessel resolvers are not candidates. |
| Impulse relevance | `impulse_relevance_metrics` (activity-api learner; relevance-sink only adds `times_failed`) | (impulse_id, activity_variant_id) | 21,100 rows; 514 updated in 7d; 19,829 have empty `typical_pointer_type`; `times_failed > 0`: **0 rows**. | Mostly not. It is keyed by impulse instance. |
| Per-producer characterization | the same table, `impulse_id = vessel:<vesselId>:<shape>` | (producer, shape) | 362 rows, all from `development-vessel:characterize-arrived-vessel`, with `times_loaded` 1–2. The 8 sampled rows date from 06-13 to 07-29. A 14d count returned empty and `math::max(updated_at)` returned null, so the column type is suspect and the staleness is indicative only. (The same caution applies to the `times_failed > 0` empty result in the row above.) | It is the only per-producer key, and it is apparently a one-shot fossil. |
| Concept usage | concept-db `concept_usage`, plus `concept.times_*` | concept | Above: 268 rows, almost all neutral. Concepts: 91,083, of which 78,952 are `impulse_signature`. | No tool key. |
| `resolver_schema` | dev-vessel `resolver-schema.ts` CONTRACTS; concept-db | shape | **5 of 407** shapes: `substrateGap_write`, `memoryNote_write`, `test_suite`, `concept_create_write`, `conceptLink_write`. | Constructibility, not rank. |
| Shape descriptions | discovery `/registry/shape-descriptions` | shape | **286/407** at 06:00Z. Track D measured 81 and REALIGNMENT 312; the count moves and is not reconciled here. | Lexical relevance. Some entries are confabulated (§2.3). |
| `mcpTool` `input_schema` | inside the catalogs | tool | 10 tools. | It is the one channel that **carries input schemas**, which is the point of the bridge. |

**The trap: the populated per-step signal is poisoned.**
- goal-host's own interlock text (`index.ts:9939-9963`) says the satisfier posteriors carry β from the satellite mis-grading bug. Suppression is held behind `SATISFIER_PROVEN_BAD_ARMED` until they are re-baselined.
- Live values: `satisfier:webSearchResult` α 12.3 / β 464.0 over 1,898 executions; `satisfier:web_search` α 1 / β 2 over 25; `satisfier:shellResult` α 398 / β 1,841 over 4,747.
- **Ranking the floor's tools by these today would sink `web_search` for the news goal**, which is the opposite of the fix.
- The re-baseline gap the source names (the sibling of `gap-mt0skq5k`) was **not found** in the 6,848-row live gap store, by id or by text. Positive control: the same `jq` regex filter matched the rhythm re-baseline gaps in the same pass.

---

## 4. Q3: how tool lists are built and producers picked today, and where a ranked list could go

| Path | Tool list | Producer pick | Ranking |
|---|---|---|---|
| goal-host floor `universalToolFallback` (`index.ts:5392`) | `UNIVERSAL_READ_TOOLS` (5 literals, `:4566-4572`) plus target shapes matching `/(_write\|_create_write)$/`, built by `ufBuildWriteTool` (schema from `resolver_schema`, else a fail-open `{content}` stub) | `ufResolveUrl` (`:4573-4599`): the first `protocol !== "libp2p"` row, else a libp2p row through the federation egress | **None.** |
| goal-host `:9560` investigation loop | `UNIVERSAL_READ_TOOLS` | same | None. |
| dev-vessel wrapper `llm-completion-dispatch.ts` | the caller's `tools`; if absent, `DEFAULT_LLM_TOOLS` (`:101`, applied `:221-223`), a **third hand list** (`source_code`, `fs_read`, `codeSearchResult`, …). Template tasks calling `llm_completion_dispatch` with no `tools` get it. | — | None. |
| llm-resolver tool loop (`index.ts:480-560`, `:700+`) | executes whatever `body.tools` names; it builds no list | `resolveToolEndpoint`: **`content.vessels[0]`, with no protocol or origin filter**, cached in `TOOL_ENDPOINT_CACHE` for the life of the process; failures cache the fallback | None. |
| goal-host walk satisfier (`:9881-10245`) | not a tool list; next shape by inference order | the endpoint map; one resolve | The posterior is read, but the proven-bad action is held (§3). |

**Where a ranked list could be injected without a new service.**
- **Producer side, one organ:** activity-api's `case 'mcpTool'` (`routes/impulses.ts:3855`). It is **(b)**: activity-api's only excluded file is `lib/posterior-update.ts`.
  - activity-api owns VPM and CTS, so ranking there follows data locality (law 11).
  - It already uses the `pointer` format that makes a tool equal a shape.
- **Consumer side:**
  - **(a)** goal-host `:5392`, which replaces the literal list;
  - **(b)** the dev-vessel wrapper's `DEFAULT_LLM_TOOLS`, which serves template LLM tasks that pass no tools. It has only the prompt as context.

  APPROACH step 1 already edits that wrapper file, so the (b) change must be a separate landing (law 12).

**Producer locality: what §9.0 requires before a ranked fan-out may include peers.** Two findings specific to this bridge:
1. **The tool impulse carries its own dispatch address.** minibob's `normalizeToolImpulse` took `m.vessel_endpoint ?? defaultVessel.endpoint` (`discovered-tools.ts:380-381`). `makeDispatchHandler` then POSTs to `${binding.vesselEndpoint}${binding.resolveEndpoint}` with the **caller's** credential, built from `auth_token_source` (`:770-800`). A peer producer could name any URL and receive our ApiKey. That is the human-ask-route injection shape again (§9.0 gap list).
   - The producer also self-reports `relevance_score`, so a peer can top the ranking.
   - activity-api's own catalog derives `vessel_endpoint` from `VESSEL_ENDPOINT`, defaulting to a `*.svc.cluster.local` k8s URL.
     - **Node 1:** it is set correctly; it answered `127.0.0.1:8080`. It is not in `/etc/substrate/env`, so a unit-level env sets it.
     - **Node 2: unverified.** `raw/live-resolvers.md:158` records a stray `activity-api…svc.cluster.local:8230` registrant there, which suggests the default fires on that node.
     - So the catalog's self-declared address is already visibly wrong somewhere in the fleet.
2. **Peer rows are already in the `mcpTool` advertiser set,** with `auth_scheme:"none"`. llm-resolver's picker takes `vessels[0]` regardless of origin. Widening any tool list to registry shapes inherits whichever picker is on that path.

**What is held until §9.0 holds:**
- the locality allowlist (discovery's `origin:"local"` vs `"peer:…"`, which is the provenance §9.1 says the typed lookup must carry);
- route auth on the producers.

**What is allowed meanwhile:** own-origin producers only, with the dispatch address taken from the discovery row, never from the tool impulse.

---

## 5. Q4: why the July floor (`43247db`) did not use `mcpTool`

- **Commits.** `git log -S mcpTool` over goal-host, llm-resolver, development-vessel and ias-executor finds no hit except dev-vessel's deny list (`1ef83560`) and residue commits. Neither `43247db` nor `1cf0b96` mentions tools-as-impulses, discovery of tools, or `mcpTool`. `43247db`'s body is about grounding.
- **Reports.** No `validation/reports/**` file before the 09-28 realignment raw collection mentions `mcpTool` in connection with the floor. `raw/memory-1.md:304` quotes the 07-10 directive.
- **Gaps.** None of the 6,848 live gaps names `mcpTool`, `discovered-tools` or tools-as-impulses as a floor defect. The only `mcpTool` gaps are the `keyword_extractor` pair.
- **Memory.** The 07-10 directive is the only memory file mentioning `mcpTool`, and it links `[[finding-llm-tool-parity-is-the-reach-blocker]]`. That file is **absent from the cache**. The substrate `memoryNote` query read for it returned recent notes regardless of topic. That is REALIGNMENT's known "recall ignores the topic" (`44ab5fd4`), so the absence is unattributed, not proven.

**Conclusion.** No recorded decision exists. The bridge's only consumer had been deleted seven weeks earlier with no port record. The floor's builders (a substrate compose on 07-11, then an operator session on 07-23) wrote local literals, and the operator directive naming `mcpTool` was not consulted. The catalogs then grew on the producer side with no reader. This is the same recurrence §2.0 describes, and the hollow `keyword_extractor` entry is its signature.

---

## 6. Proposals

Every proposal extends an existing organ; there is no new service (law 3, §2.0). One change per landing. Builders are labelled from the live `excluded_paths`.

### P1. Tools are shapes; the activity-api `mcpTool` case becomes the ranking query over own-origin shapes (b). Status: **new**, but it is the spec's own collapse clause plus `c5fd43a`'s direction.

- **Seam:** activity-api `routes/impulses.ts` `case 'mcpTool'` (`:3855`).
- **Change.** Replace the hand catalog with an enumeration of shapes that meet all three conditions:
  - (i) advertised by an **`origin:"local"`** producer (discovery `vesselCapability` rows);
  - (ii) a description is present (`/registry/shape-descriptions`);
  - (iii) the shape is not internal (reuse the orphan scan's `META_DENY` set as data, not a copy).

  Each entry is `{tool_name: <shape>, description, input_schema: resolver_schema ?? none, resolve_request_format: "pointer"}`. The dispatch address is never included: the executor resolves it through discovery.
- **Score, in stages:**
  - **Now:** lexical match of the context against description and shape tokens (the existing concept-db scorer, reused). Confidence comes from `n_observations` only.
  - **Held:** the posterior term (CTS `satisfier:<shape>` by `context_bucket`, falling back to VPM). It stays held until the satisfier re-baseline lands, the condition the `SATISFIER_PROVEN_BAD_ARMED` interlock names. File that re-baseline gap first (§3: it is not in the store).
- **Deterministic gate:** the entry list is a pure function of the discovery rows, the descriptions and META_DENY. A peer-origin row can never appear.
- **Controls:**
  - **Positive:** the news context returns `web_search` (local-tools, local origin) in the top 5.
  - **Must-fail A:** with `syzygy-hub` rows present, no entry names a peer producer.
  - **Must-fail B:** a shape whose only producer is peer-origin is absent.
  - **Must-fail C:** a context with no lexical signal returns no shape scored above the floor (no confabulated relevance).
- **§9.0:** respected. It is read-only, own-origin, and the address comes from discovery. It makes nothing newly writable: write shapes stay out unless they are already among the caller's targets.

### P2. The floor's tool list = the hand list ∪ the top-k from P1 (a). Status: **already in APPROACH step 5's "widen to registry shapes after §9.0"; this is a narrower, own-origin-only first cut.**

- **Seam:** goal-host `universalToolFallback` `:5392` (excluded, so (a)).
- **Change.** Resolve `mcpTool` (P1) with the goal and target shapes, and append the top-k (k held as a shaped value, law 1) to `UNIVERSAL_READ_TOOLS`.
  - The hand list is kept until P1's positive control has held for a window.
  - Log `floor: TOOLS [names] source=mcpTool|literal`, so the offer is observable (today only `ENTER … targetShapes=` is logged).
- **Gate:** `ufExecuteTool`'s allowlist already restricts execution to offered names, and `ufResolveUrl` already prefers local http. Add the origin check: execute only a row with `origin:"local"`.
- **Controls:**
  - **Positive:** a replay of the news goal (`a30a893c` class) shows `web_search` in the TOOLS line, and at least one `web_search` execution once agentic-floor step 1 makes executions visible.
  - **Must-fail:** a `tools: []` opt-out yields no P1 tools.
- **Ordering:** after agentic-floor step 1. Without the transcript, "offered" can't be distinguished from "used".
- **Decision carried:** this subsumes agentic-floor §9 decision 2 ("`web_search` as the one-shape exception"). The exception becomes "own-origin shapes only", which is §9.0-safe by construction.

### P3. Retire the hand lists as data, not by edit-by-edit drift (b for the wrapper, a for goal-host). Status: **new.**

- There are three hand lists:
  - `UNIVERSAL_READ_TOOLS` (goal-host `:4566`);
  - `DEFAULT_LLM_TOOLS` (dev-vessel wrapper `:101`);
  - minibob's dead `discovered-tools.ts`, a fossil to mark under REALIGNMENT §4.2.
- The wrapper's default can call P1 with the prompt as context, as a separate landing from APPROACH step 1.
- **Must-fail:** the wrapper with `tools` absent never offers a peer-origin shape.

### P4. A §2.1 row for the class behind `keyword_extractor`: a catalog entry its producer cannot serve (b). Status: **new; it is the law-6 detector for a class that has already recurred.**

- **Predicate:** every `mcpTool` entry with format `pointer` names a shape that its `vessel_id` advertises, and every entry has an `input_schema` that parses.
- Deterministic, satisfiable today, and runs on a rhythm.
- **Must-fail control:** a fixture catalog containing `keyword_extractor` against activity-api is flagged. It would have fired on 09-14.
- **Positive control:** today's live catalog (1 entry) passes.
- **Builder:** the evaluator row lives with the §2.1 evaluator (`self_fact_reconcile` registration), which is (a) because `self-fact-reconcile` is excluded. The predicate code can be (b) in activity-api tests.

### P5. Per-(shape, producer) credit, held (a/b split). Status: **in REALIGNMENT §2.2 (verdict reaches credit) and agentic-floor step 4; named here so it is not built twice.**

- Today credit is per shape. The only per-producer key, `vessel:<id>:<shape>` in `impulse_relevance_metrics`, is a stale one-shot.
- When agentic-floor step 4 routes floor calls through the satisfier step block, stamp the producer's `vesselId` on the synthetic trace task (`resolverId` is currently the shape). Then CTS or VPM can carry a (shape, producer) arm later.
- **Held** until §9.0. Ranking peer producers before route auth would make a peer's self-report steer selection.

### P6. Amendments proposed to the coordinator (REALIGNMENT)

1. **§3.3, the floor-and-walk group:** add the discovery-to-tools bridge, with its disposition. The producers are keep-general but inert. The consumer is a dropped fossil (minibob `814d215`). The collapse to "tool = shape, `pointer` format" (`c5fd43a`) is the revive form.
2. **§3.4:** "`mcpTool` producers → caller: goal-host floor (P2), after APPROACH step 1."
3. **§2.0 table:** the row "per-task tool ranking" maps to the bridge (04-25 spec, 04-26 code), killed by the 05-24 port and never recorded.
4. **§2.0b / output-shapes inference:** discovery's learned description of `mcpTool` ("molecular computation") is confabulated. Add a must-fail to the auto-describe tick: a learned description must share at least one token with its producer's advertised description or with the code that serves the shape.
5. **The satisfier re-baseline gap** named by goal-host's interlock is missing from the live store. File it (the operator files; the system should have filed it) before any posterior term in P1 is armed.

### What this track leaves to the others

- **Universal search (track 2):** `activity_search` answered the news query from **FTS** (`searchMethod:"fts"`, not dense), with `metrics: null` on the matches.
- **Activities as tools (track 3):** discover-by-shapes ranks `activity` rows only. P1 ranks resolver shapes. A unified list is track 3's question.

---

## 7. Verification status

- Every proposal is **specified, not run**.
- **Checked directly here:**
  - live `mcpTool` resolves on both producers, and through discovery;
  - the discovery advertiser rows;
  - the live constant EMA (`concept-db :196-197`);
  - the absence of `mcpTool` consumers in `/vessels/*/src`;
  - the minibob caller deletion (`814d215`) and its `origin/dev` residue;
  - the VPM, CTS, `impulse_relevance_metrics` and `concept_usage` counts;
  - the `resolver_schema` contract maps;
  - the description count;
  - llm-resolver's `vessels[0]` pick and the dev-vessel `DEFAULT_LLM_TOOLS`.
- **Not checked:** whether minibob's bridge ever ran on canary between 04-28 and 05-24. That is an unknown, not a "never".
- **Temp files** created in the host `/tmp` and the container `/tmp` (`t1-*`) were deleted after use.
