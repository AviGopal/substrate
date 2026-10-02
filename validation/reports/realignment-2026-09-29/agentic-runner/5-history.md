# Track 5: the history. The improviser and the agentic runner, from the first executor to today

2026-10-01. Read-only. Nothing was edited, dispatched, restarted or committed to produce this file. The temporary query scripts were copied into the containers and deleted afterwards.

**The question this answers:** "What happened last time we had a runner that searched, selected tools and used activities as tools, and why did the substrate lose it?"

**What this builds on.** It does not restate these; it cites them:
- `agentic-floor/E-history-of-attempts.md`. E covers the floor from 07-10 onward: the wrapper loop, the grounding-gate flips, floor→trace, floor→pathway and floor→mint, plus acceptance criteria A1–A8. This file **extends E backwards**. Its timeline stops at 07-10 and hands over to E §1b.
- `dossiers/goal-walk-floor.md` §2, which has one row for minibob (the parity benchmark).
- `dossiers/composition-crystallization.md` §1. It is the extraction timeline from 06-17, and this file uses its 08-03 `applyExtraction` row.
- `raw/git-super-1.md` "Era lineage" (the platform generations).
- REALIGNMENT (origin/dev): §1, §2.0, §3.2, §9.0, §9.5.

**Hash convention.** Every hash carries a repo prefix:

| prefix | repo |
|---|---|
| `sr:` | super-repo |
| `mb:` | minibob (`repos/deployment/vessels/minibob`, HEAD `677f8ff`, 05-20) |
| `ie:` | ias-executor-ts |
| `gh:` | goal-host-vessel. Its own repo begins 06-15; before that it lived at `sr:repos/goal-host-vessel` |
| `lr:` | llm-resolver-vessel |
| `dv:` | development-vessel |
| `aa:` | activity-api |
| `cdb:` | concept-db |
| `rv:` | ribosome-vessel |

**Sources and windows.**
- Git logs of the repos above. For the deployment repo, only the minibob submodule pointer history was used.
- The live gap store `/workspace/git/super-repo/gaps/gaps.json` on node 1 (6,848 records, read 10-01).
- The live SurrealDB (`activity-system/learning_loop`). Its earliest `activity` row is **2026-05-28T09:13Z**.
  - The K8s canary store, which held all minibob-era traces, was suspended on 05-24 (`sr:57d74520`: "Canary suspended"). It is not reachable from here.
  - So **no live store can confirm or refute reuse of a minibob-era template**, and §2 states its conclusions with that limit.
- Live source under `/vessels/*/src` on node 1 (`substrate-live`).
- Read-only `mcpTool` resolves on node 1 (activity-api :8080, concept-db :8260). On node 2 (`compose2-live`, a spoke), activity-api and concept-db are `inactive` (`/health` returns 000); goal-host returns 200, which is the positive control that the node answers. Whether a node-2 `mcpTool` resolve reaches the hub's producers through discovery was **not tested** here.

---

## 0. Answer in one paragraph

Between 03-24 and 05-06, minibob had a runner with the three behaviours the design now asks for:
- a step-by-step improviser that recorded every step's declared and actual output shape plus the impulses it loaded and created, "recorded for template extraction" (`mb:95adca0`, `mb:225ab6f`);
- activities as tools (`runActivity`, `activity`, `createActivity`);
- search before minting (`search_activities`, later `activity_search`/`trace_search`/`tool_pattern_search`), and per-task tools selected by relevance from `mcpTool` impulses over discovery (`mb:e05ecbd`, 04-26).

It extracted templates from that runner exactly once on record: three one-task templates on 04-14, whose reuse was never measured. The loss then came in three steps, each locally reasonable:
1. **Extraction was switched to observe-only** on 04-27 (`mb:360e0de`). It stayed off, unmeasured, through the whole port (until `gh:337d223` 06-30 and `rv:5f96ba4` 08-03).
2. **The improviser lost its last caller inside minibob** on 05-06 (`mb:8b918d2`, −5,600 lines). Its role passed to a two-task `improvise` template whose tool loop runs opaque inside one LLM task, which is the same shape E §2 R1 finds in today's floor.
3. **The port to ias-executor defined parity only over template replay** (`sr:openspec/changes/2026-05-19-ias-executor-as-canonical-host` §Success Criteria). It ported 13 of minibob's 75 embedded templates and none of the runner. Its `GoalHost.runGoal` **threw** when recommend returned nothing (`ie:fc63e4e`). minibob was removed 3 h 28 min after goal-host-vessel was born (`sr:e19fabd0` 19:17 → `sr:57d74520` 22:45, 05-24 −0700), and the lift gates for improvisation and extraction-from-improvisation (27.3.b.2, b.3) were unchecked and absent from `lift-status.json`.

What was left behind is a set of **producers with no consumer**:
- the `mcpTool` resolvers on concept-db and activity-api, still serving today;
- `activity_search`;
- the ribosome template, whose metadata still cites the deleted improviser call sites.

The one "consumer" of `mcpTool` in live code is a **denylist entry** that stops the orphan detector from flagging it (`dv:1ef83560`, `META_DENY`). Every later runner was rebuilt from scratch without selection, search or activities-as-tools:
- auto-draft (06-01);
- the llm-resolver tool loop (06-01);
- mint-as-you-go (06-24, never called);
- the wrapper and floor loops (07-10 / 07-23, E).

The docs then retired the citations rather than filing the gap: the bridge spec was archived on 05-27 and deleted on 08-02, the improvisation-spectrum spec was deleted on 08-02, and the improvisation sequence was rewritten on 08-05 onto a function deleted the next day.

---

## 1. Timeline, earliest executor → 07-10 (E continues from 07-10)

Columns: date · what it did · measured effect, with denominator and window where one exists · status today · why it was removed, replaced or left unwired. "Not found" means the stated search returned nothing; it is not a claim of absence beyond that search.

### 1a. Before minibob: the OpenCode-fork era (01-30 → 03-14)

| date | what | measured effect | status | why |
|---|---|---|---|---|
| 01-30 | First super-repo commits: meta-activity templates for a validation system (`sr:5a663c16`) | — | fossil | — |
| 02-06 | A "trailblazing" phase-4 executor was written, then found to duplicate an existing `TrailblazingExecutor` in the metabob-opencode fork ("retries tasks with enhanced continuation prompts") and stashed (`sr:99a0d1bc`) | — | dropped with the fork | The first recorded instance of the duplicate-runner class. The second runner was built without finding the first |
| 02-20..28 | Thompson implemented twice, then "moved to rpc-api only"; pattern extraction in the Python rpc-api (`sr:8fa83549`, `sr:825f8c27`) | "50% validation pass" (`sr:714c2d01`), a harness pass rate, not reuse | fossil | Platform generation 1 (`raw/git-super-1.md` "Era lineage" item 1) was replaced wholesale on 03-14 |
| 03-03 | "Dynamic activity creation with trailblazing" validation harness (`sr:78c2ad8d`, `sr:3993900c`) | harness only | fossil | — |
| 03-11 | Session tracking across the "LLM, deterministic, trailblazing" execution paths (`sr:512dce8d`) | "80% of activities (LLM-based) had empty sessionsSpawned", then fixed | fossil | — |
| 03-14 | agent-executor "try-create-retry": a `GoalInferenceEngine` "autonomously creates missing templates on-the-fly" when a template is not found (`sr:41c0913e`) | not found | fossil | **This is the declare-before-doing pattern** (create a template, then run it). It reappears on 06-01 as auto-draft (§1c) |
| 03-14 | minibob repo begins (`mb:540442d`); activity-api TS v2 begins 03-16 (`aa:15d4255`) | — | — | Platform generation 2 |

### 1b. minibob: the improviser and its tools (03-24 → 05-24)

| date | what it did | measured effect | status today | why removed / replaced / unwired |
|---|---|---|---|---|
| 03-17..18 | Activity-first constraint; MCP activity callbacks "for autonomous trailblazing"; the `customTools` extension point (`mb:a09d9cd`, `mb:7e6ceb4`, `mb:a84cecd`). The built-in tool set already includes `activity`, `search_activities`, `createActivity`, `create_activity_goal_seeking`, `impulse_create` (`mb:src/tools.ts:739`) | not found | dropped 05-24 | — |
| **03-24** | **`mb:95adca0` "unify improvisation traces with ActivityExecution format"**. `ImprovisationTrace` becomes an `ActivityExecution` with `templateId = improvised-<goal-slug>` and steps as `ExecutedTask` with `ToolCall`s. "Enables Thompson Sampling to learn from improvised executions" | not found | dropped | The improviser trace was first-class in the trace store from this date. Header of `mb:src/improviser.ts`: "Pure improvisation: LLM figures out what to do step by step, using available tools. **Everything is recorded for template extraction.**" |
| 03-24..26 | Improviser hardening: JSON-parse retry, stuck detection on command content, file tracking only on success, impulse tracking (`impulses_available/loaded/created`) (`mb:4c7522f`, `mb:62dab0c`, `mb:54d8389`, `mb:67a8e81`) | not found | dropped | — |
| 03-28 | "systematic template creation before improvisation" (`mb:87c6742`) | — | dropped | declare-before-doing again |
| 03-30 | `runActivity` tool: "Execute an activity by ID … Enables activity composition – activities can invoke other activities" (`mb:0526659`, `mb:a6d044b`) | not found | **dropped**. The canonical-host tasks.md:312 records "`runActivity()` still uses ActivityExecutor (**no GoalHost equivalent**)" | It had no counterpart in the port. `ie:` has the `compose` resolver (since `ie:e1edaeb`, 05-15), but that can only be **declared by a template task**; no runner can call it as a tool |
| **04-04** | `mb:87f101e` "wire template extraction from successful improvisation": imperative `extractTemplateFromImprovisation` in goal-processor and improviser-resolver | registration failed until 04-14 | removed 04-27 | — |
| **04-07** | `mb:225ab6f`: each step must declare `expected_output_shape` and `step_purpose` **before** acting. Actual shape is validated after; `outputSchema` is extracted for the ribosome. "This makes improvisation traces directly convertible to activity templates with proper input/output schemas." Same day, `mb:3d3f996`: attempt templates from **failed** improvisations | not found | dropped | This is the closest the system has come to "every step feeds the shape mechanism". No later runner records a declared-vs-actual shape per step (§3 G3) |
| 04-13 | `mb:c7af494` "prefer templates over improvisation": simple goals search templates first (threshold 0.3 → 0.1), because "Templates enable learning through traced execution" | not found | superseded | It treated improvisation as *not* learning. This is the first sign that the extraction leg was not trusted |
| **04-14** | `mb:476da58` ribosome registration fix; super-repo report `sr:b64c705e` `RIBOSOME_FIX_COMPLETE.md` | **3 of 3 novel goals → 3 templates registered** (`tpl_1776160749848_kusald`, `tpl_1776161618882_7ne50q`, `tpl_1776161686744_hnxws`), each **1 task**, HTTP 201. The checklist item "Measure cost reduction from template reuse" was **unchecked** | report deleted 04-25 (`sr:0da7e4ef`, jiggle-and-prune) | **The only recorded extraction from an improviser trace** (§2) |
| 04-16 | `mb:4065f49` "Unified execution path with arbitrary resolver graphs": `ImproviserResolver` wraps `GoalImproviser` as a composable resolver ("extracts templates via ribosome on success") | not found | — | `git log -S 'new ImproviserResolver'` hits only this commit, and only in its tests and examples. **No non-test instantiation was found** at any later commit |
| 04-25 | Spec `docs/specs/discovery-to-tools-bridge.md` (`sr:9f91c137`, reworked `sr:8a6bbcaa`). Owners: "minibob, discovery-vessel, concept-db, activity-api". Design B, "tools-as-impulses, on-demand resolution". Scoring `0.4 shape + 0.3 keyword + 0.3 relevance_ema` (0.5 uninformed prior) | — | **archived 05-27** (`sr:4167ba2a`), **deleted 08-02** (`sr:d1e60e40`) | Its only named consumer is minibob (§3 G4) |
| **04-26** | `cdb:28bd17d` "mcpTool resolver — tools as impulses"; `aa:7d3dad1` "advertise mcpTool shape with **empty-list** resolver"; **`mb:e05ecbd`** per-task discovered tools. Before each LLM task, the executor builds an `mcpTool` pointer from `input_shapes`, `output_shapes`, `task_description`, `goal_keywords` and `prior_template_id`, fans out via discovery, merges and ranks, and caps at 20. Calls dispatch to the owning vessel. Results are tagged `resolver_tier: "DISCOVERY"` | 26 unit tests; a commit-message walkthrough (concept-db's 9 tools reach the LLM for `learn-impulse-relationships` task 3). **No runtime measurement found** | **producers live, consumer dropped 05-24** | §3 G2 |
| 04-27 | **`mb:360e0de`**: the ribosome becomes a lifecycle-subscribed meta-activity (`ribosome-extract.json`). **Seven imperative extraction sites removed**, including `improviser-resolver.ts:204-228 success extraction`. "The applyExtraction default of false makes first-canary deploy **observe-only**" | 05-09: `ribosome-extract` 8 of the last 100 canary executions, `improvise` 4 (impulse-activity-loop tasks.md 8.1). Writes: 0 by construction | the template is live in `ie:src/templates/lifecycle/ribosome-extract.json`. Its `metadata.supersedes` still lists the removed improviser lines | The write path stayed gated off until `gh:337d223` (06-30) and `rv:5f96ba4` (08-03, "applyExtraction never passed", crystallization dossier row 08-03). That is **64 / 98 days** of extraction disabled by default across the port |
| 04-28 | `mb:44566da` local `mcpTool` bridge: workspace tools register as local `mcpTool` providers | not found | dropped | — |
| 04-28 | Foundation realignment `sr:28d3ac6c`: keeps "When no activity matches … the system can improvise. Improvisation MUST be recorded". Renames the sequence doc to `04-improvisation-failure-modes.md`, calling the improvisation flow "real and current" | — | rewritten 08-05 (§3 G5) | — |
| 04-30 | **`mb:193956f`**: a new embedded template `improvise` becomes the fallback of `goal-processing-activity-driven` (it replaced `execute-shell-command`). Task 2 is **one LLM task with the full tool whitelist** | — | **not ported** | From here on, minibob's default no-template path is a tool loop **inside a single task**: the opaque-node structure E §2 R1 names for today's floor |
| 05-01 | `mb:5178b17`: improvise becomes a two-task chain. `gather_context` resolves **`activity_search`** (BM25 over templates), **`trace_search`** and **`tool_pattern_search`**, all added by `aa:15bda50` the same day. `execute` either emits `DISPATCH_ACTIVITY: <id>` (dispatched as a child execution) or does the work with tools. Stated intent: "the ribosome should mint a shape-aware variant of that mapping so Thompson Sampling can pick it directly next time, retiring improvise" | `improvise_health` (reuse-harness T4.1, 200-trace window, 7 days): 05-15 **6** improvise / success 1.0 / **ribosome_activation_rate 0**; 05-17 **3** / 1.0 / 0; 05-18 **3** / 1.0 / 0; 05-23 **2** / 1.0 / 0 (`validation/results/*reuse-report.json`). 07-10 and 08-01: 0 improvise, null | **not ported**. The `activity_search` shape is live with no code consumer (§3 G2) | A success rate of 1.0 is the "it always succeeds — it generates *something*" pattern (`validation/gaps/gap-004…md`, 05-24). The activation-rate instrument read 0 on every run, and no action is recorded |
| 05-02..03 | Phase 13 parity. Baseline `sr:84200483`: minibob 0/8 vs Claude Code 7/8, and "**The improviser is never reached**". Iteration 1 routes standalone/no-backend mode straight to `improviseUntilComplete`. Then `sr:2bae0954` and `sr:9022dd67` | "9/10 prompts ≤1.5× LLM-call parity" | instrument removed 05-24 (goal-walk-floor dossier) | **Parity was measured on the backend-free path**, so the parity runs fed no trace store. Same distinction as E §1a: answering ≠ feeding the mechanism |
| 05-04 | `mb:c501af7` `load_impulse` tool: the LLM fetches any shaped data by pointer through the discovery chain. improvise prefers it over curl | not found | dropped | — |
| **05-06** | **`mb:8b918d2`** "merge aftermath": the commit removes 5,607 lines and adds 438 across 4 files, almost all of it in `goal-processor.ts`; `improviseUntilComplete` → `executeGoal`. The last non-test `new GoalImproviser` call site (`goal-processor.ts:2906` at the parent commit) is deleted. The same day `MINIBOB_FORCE_IMPROVISE` was added and reverted (`mb:8060dc0`, `mb:a9c1a05`) | — | — | **For its final 18 days the shape-declaring improviser had no live caller** (grep of `mb:HEAD`: only `improviser-resolver.ts`, which is itself not instantiated). This is not attributed to a decision in any commit message; it fell out of a merge |
| 05-15 → 05-19 | ias-executor-ts begins (`ie:e1edaeb`, with the `compose` resolver). The "canonical host" spec (`sr:2026-05-19-…`). **`ie:fc63e4e` GoalHost**: `runGoal` = recommend → top candidate → execute. **It throws when there is none**: `"GoalHost.runGoal: no template id returned for goal … Pass opts.targetTemplateId to bypass the recommend step."` (`src/examples/goal-host.ts:395-400` at that commit) | §S.1: trace-replay parity of ≥20 canary traces on `(template_id, task_ids, output_shapes)` | GoalHost lives on | **The no-template path was not a success criterion.** A regex for `improvis\|discovered-tools\|mcpTool\|search_activities\|runActivity\|tools.ts` over the change returns proposal 0, design 0, spec 0, tasks 1. The one hit is the `runActivity` "no GoalHost equivalent" line |
| 05-19 | `ie:0b5be2d` shared template catalogue: "13 canonical meta-activity templates copied from minibob" | **13 of 75** minibob embedded templates (75 at `mb:bd96455`, 05-19). Not ported: `improvise`, `goal-processing-activity-driven`, `make-activity`, `reuse-successful-activity`, `create-template-progressive` and others | — | the catalogue held lifecycle and registry-quality machinery only |
| 05-20 | Canonical-host §7.2 decision, "Path 4b thin TUI shell". `search-first-executor.ts` (1,469 LOC) and `execution-adapter.ts` (1,220 LOC) "deferred … to a dedicated migration pass" | — | never migrated | — |
| 05-23 | Pre-lift checklist (impulse-activity-loop tasks.md Phase 27): **27.3.b.2** "Improvisation demonstrably succeeds on a synthetic goal that has no matching template" and **27.3.b.3** "Ribosome demonstrably extracted at least one new template from a successful improvise … Gate: at least one activity_template row with `extracted_from`" | — | both **unchecked today** | Neither appears in `validation/state/lift-status.json` at `sr:57d74520`. That commit marks 27.3.g.1 done ("minibob removed from substrate; no in-process executor path") |
| **05-24** | `sr:e19fabd0` 19:17 −0700: goal-host-vessel is born, **261 lines** wrapping `GoalHost`. `sr:57d74520` 22:45 −0700: "remove minibob from container; substrate-only loop … ribosome-vessel handles template extraction. **Canary suspended**" | — | — | The governing reason recorded is **centralization** (27.3.g: "no implicit executors"). That matches the user's account. The behaviours were not carried; §3 |

### 1c. After the port, before E's window (05-24 → 07-10)

| date | what it did | measured effect | status today | why |
|---|---|---|---|---|
| 05-28 | Investigation 039 (`validation/investigations/2026-05-28T02-00-00Z-investigation-039.md:175`): "Improvise + ribosome-extract for improvisation traces … **Doesn't exist as a registered template today.**" At :99, improvise+ribosome is "aspirational" | — | — | the loss was noticed 4 days after retirement. No gap from it was found (§3 G6) |
| 06-01 | `sr:b12b3de8` llm-resolver "accept tools[] and run iterative tool-use loop". Each `{name,input}` is dispatched as pointer `{type: name, …input}` to `tool_dispatch_endpoint` (default dev-vessel); max 8 iterations; the response carries `tool_calls` | "fs_list → 1 tool call → 1 iteration" (one live probe) | **live** (`lr:src/index.ts dispatchTool`); routed by discovery since `lr:1333e3f` (07-10, cited by `dv:ff3d5d58`) | **The runner was re-implemented from scratch** eight days after retirement. Tools are supplied by the caller: no relevance selection, no search, no activities-as-tools, no per-step shape record. Its executed `tool_calls` are what dev-vessel later drops (E §1b, the 09-30 gap) |
| 06-01 | `sr:cf0fea3a` / `7ae17e71` / `efa46057` auto-draft: on a recommend score < 0.3, goal-host dispatches the LLM drafter **before** acting and runs the drafted template | **454** `gap-closing:auto-*` activities from 06-01, later called "dead cruft, structurally uncomposable" (`sr:4a390c6b`, 06-17) | still in goal-host (8 `autoDraft` references) | **Law 4 inverted**: activities declared before any doing, not extracted from a reached execution. It descends from the 03-14 try-create-retry |
| 06-22 | `gh:15620e7` reach→mint: "ribosome-extract had **0 executions EVER** because the ribosome-vessel … dispatched it to activity-api … the trace store, NOT an executor" | 0 → 1 execution, failing | live (`mintReachedTrace`) | **From 05-24 to 06-22, nothing in the substrate extracted anything** |
| 06-23 | `dv:1ef83560` orphaned-capability scan, which "mines advertised-but-uninvoked capability". Its `META_DENY` set lists `"mcpTool"`, `"activity_search"`, `"trace_search"`, `"tool_pattern_search"` as "activity-api learning / read shapes (owned, not outward capability)" (`src/resolvers/orphaned-capability-scan.ts:124-130`; live on node 1) | — | live | **The orphan detector is told not to see the orphaned bridge** (§3 G2) |
| 06-24 | `gh:001bd2d` "mint-as-you-go": `mintResolverWrapper` tagged `["auto_minted","improvise",…]`, log line "(improvise/Reserve-Improvisation; no existing producer)" | — | **deleted** `gh:6a6eaa4` 08-06: "there is no call site, so the improvisation slot it describes has never existed at runtime" | The sibling `author_producer` path (`gh:f39b805` 06-24) is live at `gh:index.ts:10589`. It wraps a live *resolver*; it does not improvise steps. A `"improvise"` value survives only in a type union (`gh:index.ts:7189`) and is assigned nowhere |
| 06-30 | `gh:337d223` passes `applyExtraction: true` on reach→mint | the first goal-host path able to write a template since 04-27 | live | — |
| 07-10 | `dv:ff3d5d58` `DEFAULT_LLM_TOOLS` "floor tool names" reconciled to advertised shapes | → **E §1b** | live | E covers everything from here: 07-23 `gh:43247db` client loop, 07-27 `gh:559a55d`, the 09-30 dropped tool_calls |

### 1d. Disposition of each minibob behaviour

| minibob behaviour (source) | ported and live | ported and dead / unwired | dropped |
|---|---|---|---|
| Step-by-step improviser with a declared/actual shape and impulses loaded/created per step (`improviser.ts`, `225ab6f`) | — | — | **dropped** (no caller after 05-06; not in the port) |
| `ImprovisationTrace → ActivityExecution` (`95adca0`) | the generic trace sink (`ie:` TranslatingTraceSink) for **template** executions | — | the per-step shape fields |
| Extraction from improvisation (`87f101e`, `3d3f996` attempts) | `ribosome-extract.json` (ie catalogue), fed by walk/composite reaches via `mintReachedTrace` | its write path was gated off 04-27 → 06-30 / 08-03. It has never received a runner/floor trace (E §1e) | imperative success and attempt extraction from improvisation |
| Activities as tools (`activity`, `runActivity`, `createActivity`) | `ie:` `compose` resolver (template-declared sub-activity, cycle guard, nested trace) | — | **callable from a runner's tool list**: no runner tool dispatches an activity |
| Search before minting (`search_activities` → `activity_search`/`trace_search`/`tool_pattern_search`) | the `aa:` resolvers serve, and `activity_search` is advertised as an `mcpTool` (`aa:c5fd43a`, 07-30) | **no code consumer** on node 1 since 05-24 (grep of `/vessels/*/src`: only activity-api itself, the dev-vessel denylist, and a comment in `gh:goal-target-inference.ts:674`) | the `gather_context` step that consumed them |
| Per-task tool selection by relevance over discovery (`discovered-tools.ts`, `e05ecbd`) | `cdb:` and `aa:` `mcpTool` resolvers answer live on node 1 (positive control: activity-api returned `activity_search` at 0.27; concept-db returned `concept_search`, `concept_cooccurrence_edges`, …) | the per-tool EMA prior is a placeholder (shared brief); there is no consumer | the executor-side fan-out, merge, rank and dispatch |
| `load_impulse` tool (resolve any pointer via discovery) | goal-host's walk resolves shapes, but not as an LLM tool | — | as a runner tool |
| `DISPATCH_ACTIVITY` directive | — | — | dropped |

---

## 2. Were improviser traces ever extracted into templates that were reused?

**Extracted: once on record. Reused: no evidence exists, and the store that could hold it is gone.** Three denominators:

1. **Minibob, imperative path (04-04 → 04-27).**
   - On 04-14, 3 of 3 novel goals registered a template each. Each template had **1 task** (`sr:b64c705e`).
   - Reuse was listed and left unchecked ("Measure cost reduction from template reuse"). The report was deleted 11 days later (`sr:0da7e4ef`).
   - Searched and not found: any later commit, report or harness naming a `tpl_*` or `improvised-*` template being selected, across the super-repo (`git grep` over `validation`, `openspec`, `docs`) and the minibob log.
   - A one-task template extracted from a one-step improvisation is a cached tool call, not a composition. It carries no edge.
2. **Minibob, lifecycle path (04-27 → 05-24).** This path was observe-only by default (`applyExtraction=false`).
   - The only standing instrument, `improvise_health.ribosome_activation_rate`, read **0** on each of the four reports examined that had improvise traces (05-15: 6; 05-17: 3; 05-18: 3; 05-23: 2; denominator: improvise traces in a 200-trace window).
   - Gate 27.3.b.3 ("at least one activity_template row with `extracted_from` pointing to a trace") was never checked.
3. **The live store (from 05-28).** Read 10-01:
   - `activity` has **0** rows whose id or name contains `improvis`, of 4,026 rows.
   - Positive control through the same predicate: **529** rows whose id contains `learned-`, and the `universal` name-match returns rows.
   - The only floor-era extraction is E §1d's `learned-universal-tool-fallback`: a single-node copy of the floor that reached 3 of 32 attempts and was never substituted.
   - Crystallization was "proven" on 09-18 for **walk composites**, not runner traces (crystallization dossier row 09-18, later partly retracted).

So the design's loop, "improvise → extract → register → reuse" (the stated goal of `sr:b64c705e`), has **never closed once on record**, in any era. Extraction was alive only during the 13 days (04-14 → 04-27) when the improviser's steps were being recorded with shapes, and nobody measured reuse in that window.

---

## 3. Governing reasons the capability was lost

**G1. The port's parity was defined over templates, so the no-template path fell outside it.**
- The canonical-host proposal's five success criteria are:
  1. trace-replay parity on `(activity_template_id, task_ids, output_shapes)`;
  2. lifecycle subscribers;
  3. forge;
  4. reuse/recommend MRR;
  5. a minibob LOC threshold.
- None concerns a goal with no matching template.
- `GoalHost.runGoal` made the gap explicit: it throws ("Pass opts.targetTemplateId to bypass the recommend step").
- The catalogue carried 13 of 75 templates and excluded `improvise`.
- The runner was not cut on a decision. It was **never in scope**, so no checkbox recorded its loss.

**G2. Pieces ported or left behind without consumers. The detector for that class was told to look away.**
- The `mcpTool` resolvers (`cdb:28bd17d`, `aa:7d3dad1`, both 04-26) were built for exactly one consumer: minibob's `getDiscoveredToolsForTask`. That consumer was deleted on 05-24. The producers kept serving, and kept being *extended*:
  - `aa:c5fd43a` (07-30, autonomous) added `activity_search`;
  - `aa:1f7ac34` (09-14, autonomous) advertised `keyword_extractor`. That tool's "only one lives in minibob", so activity-api "cannot serve" it (gap `failing-test-activity-api-impulses-mcptool-advertises-keyword-extractor-it-cannot-serve`, opened 09-30 10:59Z, closed 19:32Z). A producer modelled on a deleted consumer's vocabulary is a ghost of the port.
- `dv:orphaned-capability-scan` exists to find "advertised-but-uninvoked capability". Its `META_DENY` excludes `mcpTool`, `activity_search`, `trace_search` and `tool_pattern_search` from the start (`dv:1ef83560`, 06-23). **A denylist entry is not a consumer.** It is the reason the class never became a gap. The same was true of `ribosome-extract`, which had "0 executions EVER" for 29 days (`gh:15620e7`) because it was dispatched to a non-executor.

**G3. Behaviours re-implemented from scratch, one at a time, each without the step record.**

| date | what was rebuilt | minibob analogue |
|---|---|---|
| 06-01 | llm-resolver tool loop: caller-supplied tools; no selection, search or activities | `improviser.ts` loop |
| 06-01 | auto-draft (declare a template, then run it) | `87c6742` / `41c0913e` |
| 06-24 | mint-as-you-go "Reserve Improvisation": no call site, deleted 08-06 | `create_activity_goal_seeking` |
| 07-10 | wrapper `DEFAULT_LLM_TOOLS` (E) | built-in tool list |
| 07-23 | goal-host `runGroundedToolLoop` with 5 hand-written read tools (E) | built-in tool list |

- None of these records `expected_output_shape`, `actual_output_shape`, `impulses_loaded` or `impulses_created` per step, the four fields `mb:225ab6f` introduced "so improvisation traces are directly convertible to activity templates".
- Two loops now share the name "floor" (E §1b). Neither knows minibob's existed.
- This is the platform-lineage pattern in `raw/git-super-1.md`: the same mechanisms re-implemented on each generation, here inside one generation.

**G4. Extraction was disabled before the port and stayed disabled through it, with its instrument reading zero.**
- `mb:360e0de` replaced a working path (3 registrations on 04-14) with an observe-only one, "until … the quality threshold is calibrated".
- No calibration is recorded.
- The goal-host path first passed `true` on 06-30. The ribosome-vessel path got its one-line fix on 08-03, "`applyExtraction` never passed" (crystallization dossier).
- Meanwhile `ie:948d085` (08-02) measured the cost of the missing default: "218 UNRESOLVABLE_GATE and 457 failed executions in 6h — every extraction discarded at the last step".
- **The loss of the improviser's learning leg preceded its retirement.** By 05-24 the improviser was producing traces that nothing could turn into structure. Retiring it did not look like a loss to any instrument.

**G5. Retirement was justified on centralization, and the gates that would have caught the loss were not on the lift ledger.**
- The commit that marked 27.3.g.1 done ("no in-process executor path") removed minibob 3 h 28 min after its replacement existed.
- 27.3.b.2 and 27.3.b.3 (improvisation succeeds; ribosome extracts from improvisation) were written the day before and are absent from `lift-status.json`. They are still unchecked.
- The decision was right on its own terms: the user's account is that minibob was bloated and centralized. But it was **evaluated on placement, not on capability**. That is the "vessel set = placement, never capability" rule (memory; cf. CLAUDE.md law 11) applied backwards: a placement change silently removed a capability.

**G6. The docs retired the citations instead of filing the gap (law 9 inverted).**
- `discovery-to-tools-bridge.md` was archived 05-27 (three days after its consumer died) and deleted 08-02. `aa:src/config.ts` still cites it as `docs/specs/discovery-to-tools-bridge.md`, a dangling expectation.
- `openspec/meta/improvisation-spectrum.md` described four modes: template-driven, goal-seeking, **search-first**, pure improvisation. It was deleted in `sr:3b5035d7` (08-02) under the rule "**whose described behavior appears nowhere in vessel source**". The behaviour was absent *because the port dropped it*, so the rule converted a capability gap into a deletion.
- `sr:1150750f` (08-05) rewrote `04-improvisation-failure-modes.md`.
  - It deleted the Key Insight: "the ribosome resolver extracts successful improvisations into reusable templates".
  - In its place it says: "There is no separate improvisation mode … covered by two mechanisms in the walk": **bridge minting (`mintResolverWrapper`)** and **the floor**, where "every step of the attempt lands in a trace".
  - `mintResolverWrapper` was deleted the next day (`gh:6a6eaa4`) and is still cited in four docs (`04-…md:23,124,179,474`; `02-impulse-resolution.md:165,188,407`; `sequences/README.md:41`; `01-activity-selection.md:111,289`).
  - The floor claim is falsified by E (438 of 438 and 470 of 470 floor rows `tools=0/0`).
- Meanwhile `IMPULSE_ACTIVITY_FOUNDATION.md` still says "Improvisation succeeded: extract as new activity template" (E §3). The foundation states the behaviour, and the sequence doc says that behaviour is covered by mechanisms that do not exist.

**G7. Each loss was noticed and not filed (law 6).**
- Investigation 039 (05-28) named the missing "improvise + ribosome-extract" loop.
- The `improvise_health` instrument read 0 four times.
- The canonical-host tasks recorded "no GoalHost equivalent" for `runActivity`.
- A filter of the live gap store for `improvis|mcptool|activity_search|search_activities|minibob|discovered.tool|runactivity|activity.as.tool` returns **no gap** about a runner lacking search, tool selection or activities-as-tools. Positive control: the same filter returns the `mcptool … keyword_extractor` gap and `activity-api-accepts-unsigned-minibob-bearer-tokens`.
- The class has been invisible to the gap triple since 05-24.

**What did not cause it.** The bridge does not lack a design: the 04-25 spec is complete, and its scoring is implemented vessel-side. The resolvers are not dead: both answer on node 1. The machinery is there. The **consumer** is missing, along with the **step record** that would make a consumer's steps extractable.

---

## 4. Acceptance criteria for "the runner walks with selection, search and compose, and feeds extraction"

**Scope.** No seams and no builders here; tracks 1–4 own those. These criteria extend E §4. **E's P0, A1–A8 apply unchanged** and are not restated. Labels: P0.1–P0.3 and A1–A8 are E §4 (existing). P0.4 is REALIGNMENT §9.0 applied to tool dispatch (existing precondition, new application). P0.5 and S1–S6 are new. The criteria below add what E does not cover: selection, search, compose, and an extraction product built from them.

Every criterion:
- holds on **node 1 and node 2**. On node 2, which is a spoke with activity-api and concept-db inactive, each one is read through node 2's goal-host and discovery route record, **never through a node-2 port**;
- is checked by a **standing activity on a rhythm**, not an operator snapshot;
- carries a **positive control** through the same address and a **must-fail control**;
- reports its window and its denominator.

**P0 additions. If any is false, every S-criterion is "not evaluable", never "met".**
- **P0.4. §9.0 holds for tool dispatch.** The bridge dispatches by POSTing to a vessel's advertised `resolve_endpoint` with an advertised `auth_scheme`, which is exactly the address-and-writable seam that REALIGNMENT §9.0 holds.
  - Until shape locality (a positive allowlist stamped by discovery) and route caller-authentication cover every `mcpTool`-advertised endpoint, S1 and S3 are held.
  - **State what is held:** today only discovery and activity-api authenticate, and activity-api accepts an unsigned bearer (gap `activity-api-accepts-unsigned-minibob-bearer-tokens`, open).
- **P0.5. A step record exists.** Every runner step persists:
  - its declared output shape;
  - its actual output shape;
  - the input impulse ids it consumed;
  - the output impulse id it produced.

  This is the `mb:225ab6f` and `mb:95adca0` contract. Positive control: a walk step's task row carries input and output shapes today (E A1). Must-fail: a step whose actual shape is unknown is recorded as `unknown`, not omitted.

**S1. Selection by relevance. The tool list is built by the executor from `mcpTool` resolves.**
- Over the window, (runner executions whose tool list came from ≥1 `mcpTool` resolve attributed to that execution id) ÷ (runner executions) = **1.0**. That is equality, not "> 0".
- Hand-written tool constants may appear only as a named, counted fallback tier.
- **Learning:** a tool used in a *reached* run ranks higher on the next resolve with the same context than one used in a *not-reached* run. The vessel-side `relevance_ema` term moves on outcome; today it is a placeholder.
- Positive control: a node-1 resolve returns `activity_search` (0.27) and concept-db's tools (read 10-01).
- Must-fail controls:
  - a run whose tools came only from a constant list counts as unselected;
  - a run whose only `mcpTool` reader is a detector or denylist counts as no consumer.

**S2. Search is consumed, not merely available.**
- In ≥1 runner execution per window, an `activity_search` (or successor) resolve is made by a step, and its result impulse is an **input impulse of a later step in the same trace**.
- Report (searches consumed) ÷ (searches made), and (runs with a non-empty candidate set) ÷ (runs that searched).
- Positive control: minibob's `gather_context` → `execute` did exactly this (05-01 → 05-23).
- Must-fail: the current state, a served shape with 0 code consumers, reads as unmet.
- **Denylist rule:** `META_DENY` no longer lists `mcpTool`, `activity_search`, `trace_search` or `tool_pattern_search`. Either the orphan detector fires on them, or each has a cited consumer. Adding a shape to a denylist is itself counted as a recurrence (law 7).

**S3. Activities are callable as tools and compose with edges.**
- A runner tool call that dispatches an existing activity produces a **child execution** whose `parent_execution_id` is the runner's execution.
- Within one tick it also produces an `activity_composition_graph` edge (the same predicate as E A2).
- Report (child rows) ÷ (activity tool calls).
- Must-fail: a directive parsed from LLM text that yields no child row (the `DISPATCH_ACTIVITY` failure mode) counts as 0.
- Cycle control: a self-dispatch is refused by the ancestor guard and recorded as such. This is the `ie:` `compose` contract, extended to runner calls.

**S4. Extraction consumes the runner's steps, and the product is not a copy of the runner.**
- A `reach→mint` line names a runner execution (E A3).
- The minted template's tasks name the **producers the steps used**: a searched activity, a selected `mcpTool` tool, a sub-activity. Each task has non-empty input and output shapes, taken from P0.5's record.
- taskCount ≥ 2.
- Must-fail controls:
  - no task resolver equals the runner, the floor, or `llm_completion_dispatch` as a whole loop. This extends E A3's `minted-copy-of-the-floor` control to "not a copy of the wrapper either";
  - a 1-task template from a 1-step run, the 04-14 shape, does not count toward S4.

**S5. The ceiling reuses it with first- and last-mile adaptation.**
- Within the window, ≥1 S4 template is selected for a goal whose `goal_hash` differs from its source, and it reaches (E A4).
- Additionally, ≥1 such selection binds **different inputs** (first mile) or carries its output to **a different target shape** (last mile).
- Report (S4 templates reused) ÷ (S4 templates minted).
- This is the measurement minibob listed and never took (`sr:b64c705e`, "Measure cost reduction from template reuse").

**S6. Search before mint is enforced at the runner.**
- Over the window, (runner-originated mints or drafts preceded by a search in the same trace) ÷ (runner-originated mints or drafts) = 1.0.
- Must-fail: an auto-draft without a preceding search, the 06-01 shape, counts against S6.

**D. Durability (law 7). For 14 days, none of these recurs:**
- a shape advertised as an `mcpTool` with no serving resolver (the `keyword_extractor` class);
- a new `META_DENY` entry for a tool or search shape;
- a doc citing a runner mechanism that `git grep` finds no definition of (the `mintResolverWrapper` class).

Plus E's A8 families. Retirement of a runner component must carry a named successor that meets S1–S3; a placement-only argument does not count (the 27.3.g lesson).
