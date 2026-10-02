# 3 — What the architecture says a surface is, and the contract for rendering impulses

Read-only investigation, 2026-10-02, about 07:40–08:10Z. Nothing was dispatched, written (except this
file), restarted or committed. The only POSTs were read shapes (`activeDispatches`, `goalWalkState`,
`vesselCapability`) and SurrealDB `/sql` SELECTs. Every number names its denominator and window.

Sources read: `docs/architecture/{IMPULSE_ACTIVITY_FOUNDATION, SUBSTRATE_AS_SOFTWARE, SUBSTRATE_AS_DYNAMICS,
HUMAN_PARTICIPATION, EXPLICABILITY_SURFACE, WORKBENCH_CHAIN_UX_DESIGN}.md`, `sequences/02-impulse-resolution.md`,
CLAUDE.md, REALIGNMENT from `origin/dev` (§2.2, §2.4, §2.5, §9.0, §9.4, §9.5), and the openspec changes
`surface-render-contract`, `human-surface-stack` (design, render-learning), `do-anything-surface`,
`surface-participation-loop`. Code: `repos/human-surface-vessel` (src + ui/src, local tree, including
uncommitted files of another session, read but not touched), live `/vessels/{development-vessel,
activity-api, ias-executor-ts}/src`. Prior reports are cited, not redone.

---

## 0. Summary

- **The ontology defines a surface as a resolver boundary for a human.** The human is an implicit,
  boundary vessel (FOUNDATION "Implicit Vessels"; HUMAN_PARTICIPATION line 7). The surface is an
  explicit vessel that serves question, feedback and rendering shapes to that human. It reads impulses
  **metadata-first** and materialises content **only where needed** (sequences/02 "Dual-Mode Content
  Formatting"; WORKBENCH_CHAIN_UX §2: "preview an impulse's metadata without forcing its content to be
  resolved").
- **The surface's rendering half already follows that contract.** It has one `Content` type, one
  `<Rendered>` frame, a planner that dispatches on form (never on shape), tiers recorded in
  `decidedBy`, a pin and a learned table read at use time, and an honest `stub` and `truncated`
  state.
- **Its input half does not.** Every `Content` the run view draws is built from goal-host's
  **dispatch record**: `poolProvenance` previews (≤2,000 chars), `walkLog` strings and `answerBody`. No
  impulse reference reaches the browser that can be resolved: no id that addresses anything, no
  executionId on the content, no producer beyond the constant `"goal-host-walk"`.
- **This was a design decision, not drift.** `do-anything-surface` §3.0 named `poolProvenance` "the
  evidence ledger", and `surface-render-contract` built `fromProvenance` on it. Both decisions run
  against the foundation doc and against sequences/02.
- **The chain the contract needs already exists as ids.** Example: trace `exec_dj16h7l3` (a
  `learned_pathway` run) carries 7 tasks with real `input_impulse_ids → output_impulse_ids` edges,
  ending in `activityTemplate` and `learningSummary`. But `output_impulses: null`,
  `input_impulses: []`, and none of those ids resolves anywhere.
- **That run class has nothing on the dispatch record to draw.** It was 29 of the newest 50
  dispatches. Each had zero provenance entries, no goal text and no answerBody.

The contract proposed below: a surface takes an **impulse reference** (`impulse_id`, shape, `executionId`,
metadata including size, producer, consumed ids and timestamps). Its "lazy resolve" is a **read of the
recorded instance by id**, never a re-dispatch of the shape. Its output is a rendered form chosen by
policy and learning, plus the human's response written back as a shaped impulse authored by the
authenticated identity (§9.0).

---

## 1. What the documents say

### 1.1 What an impulse is

| Claim | Where |
|---|---|
| "An **impulse** is a pointer to data with metadata that describes its shape." The four-primitive minimum set is impulse, pointer, resolver, vessel. | FOUNDATION "The Two Primitives", "Minimum Self-Stable Set" |
| `Impulse { id, pointer{type,…}, metadata{shape, rowCount, columns, summary, sample, availableOps, producedBy}, loaded, content?, budget?, priority? }` | FOUNDATION interface; sequences/02 "Key Concepts" 1 |
| "The metadata allows reasoners … to understand the current state **without loading all the raw data**." | FOUNDATION "Key insight" |
| "The pointer is the shape … All resolution and all learning are keyed on the pointer." | FOUNDATION "Pointer-as-Shape" |
| "Trace = a recorded set of impulses (inputs, intermediates, outputs)." | FOUNDATION "Minimum Self-Stable Set" |
| The pool is presented **metadata-first**: `{id, shape, summary, loaded}`; content is attached only when asked for and loaded. "An impulse is a **lazy pointer with metadata**." | sequences/02 "Dual-Mode Content Formatting" |
| "There is no content-truncation step … a silently truncated impulse would make a downstream failure unattributable." | sequences/02 "Truncation Algorithm" |
| The data-plane invariant: every vessel-to-vessel exchange is a typed impulse resolved by shape through discovery. | FOUNDATION "Minimum Self-Stable Set" |
| **Known gap.** `ImpulseStore` mutators emit nothing, so entering, loading and unloading are invisible events. | FOUNDATION "The layer that is missing" |

### 1.2 What a surface is

| Claim | Where |
|---|---|
| "Humans participate as implicit vessels. Human-surface is an explicit communication boundary, with discoverable question, feedback, and rendering capabilities." | HUMAN_PARTICIPATION:7-8 |
| The operator is "itself an implicit vessel … a **node in the topology** whose interior the substrate reconstructs from what crosses the boundary." | FOUNDATION "Implicit Vessels" |
| "Humans are resolvers, not preprocessors." | CLAUDE.md law 13 |
| "Human-surface-vessel is **one renderer** and onboarding path; it is not the system's canonical model of human interaction." | EXPLICABILITY_SURFACE "The interface is a learnable substrate composition" |
| "System presents an outcome → Produced impulses and artifacts, rendered according to content form and policy. What must remain traceable: **Source, content, pathway and evidence scope**." | EXPLICABILITY_SURFACE table |
| "A truncated preview links to a complete artifact or explicitly says that the full artifact is unavailable." | EXPLICABILITY_SURFACE "Interaction contract" |
| "Each impulse is a visible object carrying its shape … **preview an impulse's metadata without forcing its content to be resolved**." | WORKBENCH_CHAIN_UX §2 |
| "Never present a prediction as a result." "Never invent a vessel address." | WORKBENCH_CHAIN_UX "Must Never" |
| R4 "Show content, not receipts. Outputs are a set of shaped impulses; each is rendered with its content, its true length, and whether what is shown is all of it." R5 "A run is a job with an identity, and the durable record is the trace." | human-surface-stack design §1 |
| "Human: Obsidian vessels — each connected vault is a surface." | CLAUDE.md "Interaction surfaces" |

### 1.3 What the documents say about presentation shapes

| Shape / mechanism | What the docs claim | Live (10-02, node 1) |
|---|---|---|
| `human_presentation` | A shaped answer for a human, emitted on a reached walk (`a72ad1a`, "relevance is a deterministic placeholder"). | **0 producers** (`vesselCapability`, positive control `goalWalkState` → 4 rows). It is emitted only into the walk's in-process pool, after the verdict. Its only reader is goal-host itself (B-pool-provenance §4). |
| `goal_answer` | The answer as an impulse. | **0 producers**. In-pool only, reach-gated. |
| `uiPanel_write` / `uiQuestion_write` / `uiPanel` | Panels and questions authored by activities. SUBSTRATE_AS_SOFTWARE:137 names **stateful-ui** as owner ("the substrate's face"). | 11 producer rows, **first row `stateful-ui-vessel`**. human-surface serves both shapes. Panels carry no author or dispatch link (5-delivery §2.2). |
| `renderPolicy` / `renderPolicy_write` | Presentation steered by a shaped impulse read at use time (law 1): `formByShape` (human pins), `learnedFormByShape` (learner), `maxPreviewChars`, `presentation`. | Served by human-surface; the planner reads both tables (`ledger.ts:849-856`). |
| `surfaceIntent` | Typed instruction → policy change, with unparsed demand kept. | Served. It is a **resolver, not an activity** (render-learning §8, item 4). |
| Content forms | A closed set: `prose, text, rows, diff, empty, terminal, record, scalar, stub`. Verbatim is the default; dispatch is on form, never on shape. | Implemented. `CONTENT_FORMS` is mirrored in `packages/design-tokens` and `src/surface-intent.ts`. |
| Form-choice tiers | Three tiers: (1) **declared by the producer in impulse metadata**, (2) learned policy, (3) inferred for an unseen shape. Below them sit the heuristic floor and verbatim. | Tier 1 **absent**: the planner's input is `(shape, preview, truncated)` (`ledger.ts:840`) and no metadata reaches it. Tier 2 present, demote-only. Tier 3 deliberately unbuilt. |
| `interactorObservation`, `uiFeedback` | Telemetry and answers, the reward inputs. | Stored. `form_decision` rows feed the demote-only form learner (`src/form-learn.ts`). |

---

## 2. The contract: a surface is a renderer for impulse references

### 2.1 The load-bearing distinction: read the recorded impulse, do not re-resolve the shape

The foundation's "lazy resolve" means: resolve the pointer when the content is needed. For a
surface showing a **past** run, that cannot mean POSTing the pointer's shape to its producer again:

- `web_search` or `llm_completion` would **re-execute**, costing money and returning different
  content. The surface would then show an output the run never produced, which is "a prediction
  presented as a result".
- The surface's own proxy already states this boundary: "`POST /resolve` with an ordinary shape
  EXECUTES that shape. A `vesselCapability` pointer … runs nothing" (`src/routes/proxy.ts`, comment
  above `isCapabilityPointer`).
- Provenance is the **recorded instance**. A trace is "a recorded set of impulses". Its members are
  addressed by id, not regenerated by shape.

So a surface's input is an **impulse reference**, and its lazy resolve is a **read of a content
record keyed by `(executionId, impulse_id)`**. The read is idempotent and side-effect free, and it
returns 404 or "not retained" honestly. A live run is the one case where it may mean "the content
is still in a producer's memory". Even then it stays a read, never a dispatch.

This distinction is absent from both openspecs, and it is what makes the contract safe under §9.0:
a read by id selects no target and asserts no origin.

### 2.2 Inputs: what the producer side must supply

One **impulse reference** per pool member. Each is shown first without its body, then drawn from the
body when it is needed.

| Field | Purpose for the surface | Supplied today? |
|---|---|---|
| `impulse_id`, unique per execution and durable | Addressing, dedup, edges | **No.** `walk-<shape>-<n>` comes from a per-walk counter and collides across walks; 0 rows in the `impulse` table (B-pool-provenance §0.4). The engine ids in trace tasks (`dev:llm_completion_dispatch_5ek12x73`) are durable as strings but resolve nowhere. |
| `executionId` (+ `dispatchId`, attempt index) | Link to the trace (provenance) and to the run | Partly. On the dispatch record, not on each impulse. `Content.provenance` has no `executionId`, although design.md §2 lists one. |
| `shape` | Badge, pin key, learned key | Yes. |
| `pointer` (type + params) | Where the content lives | **No.** `mkImpulse` uses `pointer:{type:"memo"}` (in-process). In the `impulse` table, 77,603 of 112,976 rows are `memo` and 35,373 have no pointer type. **0 resolvable pointer types.** |
| `producedBy` (activity / resolver / tool id) and `vessel_id` | Source line in the frame | **No.** The constant `"goal-host-walk"` on **14/14** newest dispatches carrying provenance (the newest 50 activeDispatches, ~07:50Z). The real producer survives only as prose in `summary`. |
| `consumedIds` (input impulse ids actually bound) | Edges for the chain view | **No** on the walk pool. Trace tasks carry `input_impulse_ids` (positional or real; B-pool-provenance §2.1). |
| `size: {chars, tokens?}`, `truncated`, `cut_reason`, `stop_reason` | Completeness strip ("first N of M") and the §9.2 abstain | `chars` and `truncated` yes (on the preview). `stop_reason` no. |
| `contentForm` (declared, optional) | Tier-1 form choice ("declared by the producer") | **No.** |
| `summary` (human/LLM-readable, metadata only) | The metadata-first preview row | Yes (free text, mixed with producer prose). |
| `at` (produced timestamp) | Ordering, age | Only on `poolEvents` (≤64, no content). |
| `reach role`: `target`, `completion`, `answer` or `evidence` | Which impulse leads the view | Partly. `completionShapes` and `pendingTargets` sit on the record. `goal_answer` exists in the pool only on reach. |
| `author` (for human-originated impulses) | Attribution of contributions | **No.** Panels and feedback carry none; the surface has no inbound auth (§9.0). |

### 2.3 Outputs

1. **A rendered form.** `plan(content, policy) → RenderPlan` with
   `decidedBy ∈ {declared, pin, learned, …heuristic, default}`. It is drawn by `<Rendered>` at a
   density, and the decision is recorded (`form_decision`) so it can be graded. **Already built.** The
   only missing tier is `declared`.
2. **A human response, written back as a shaped impulse.** Examples: `goal_verification_label`
   (grade), `uiFeedback` (answer or complaint), `solicitationResponse_write`, `poolImpulse_write`
   (context), `renderPolicy_write` via `surfaceIntent`. Each response must name the impulse or
   execution it is about (`target_execution_id`, `target_impulse_id`, `attempt`). Its **author is
   stamped server-side from the authenticated caller**, never from a body field (§9.0; 5-delivery P2).
   **Partly built.** Grades carry `executionId`. Responses carry no author and no target impulse id.
3. **Exposure records.** These state which impulse refs were shown, in which form, and for how long.
   They are what lets the form and relevance learners attach credit to what a person actually saw
   (EXPLICABILITY "Credit must be attached to the variant actually experienced"). **Built** for
   questions (`exposure.ts`). Not keyed to impulse ids.

### 2.4 Invariants (each written so that a check can refuse a violation)

- **C1. No scraping.** The surface never derives content, producer, attempt or size by parsing log
  strings. A `walkLog` line is rendered only as a log line.
  Today's violation: `bestOutput.ts` reads `HOLLOW-CONTENT` excerpts.
- **C2. Read, not run.** Every content fetch is a read by `(executionId, impulse_id)`. Any
  surface-originated POST to a resolve route carrying an executing shape is a violation, unless it
  is the human's own dispatch or response write.
- **C3. Completeness is stated on the content.** `shown` / `total` / `retained:false` always
  accompanies a body. Absence is "not retained", not "empty". **Built** (`Rendered.completeness`).
- **C4. Form by form, never by shape name.** Shape-keyed tables are allowed only inside
  `renderPolicy` (pins, learned) or in a producer's declaration.
  Today's violation: `bestOutput.ts`' `NOT_OUTPUT` / `EVIDENCE` sets.
- **C5. Provenance is the trace.** Each rendered impulse links to its execution and its producer
  task. The run view is a projection of the trace's impulse graph, not a second record.
- **C6. Responses are addressed and authored.** Every write names its target impulse or execution
  and carries an authenticated author.

---

## 3. Today's code against the contract

### 3.1 Where the surface already behaves as a shape renderer

| Organ | File | Contract role |
|---|---|---|
| `Content` + adapters (`fromProvenance`, `fromPanel`, `fromResponse`, `fromText`, `fromStream`, `fromLedgerEntry`) | `ui/src/lib/content.ts` | Input normalisation. The `state` union (`full / truncated / streaming / closed / failed / absent`) is exactly the completeness vocabulary C3 needs. |
| `<Rendered>` (frame, densities, error boundary, decision recording) | `ui/src/components/Rendered.tsx` | Output 1. |
| `planContent` (pin → learned → truncated-envelope → partial JSON → heuristic → `text`) | `ui/src/lib/ledger.ts:840-880` | Form choice, recorded in `decidedBy`. |
| `stub` form ("pointer only", `f8bc7d61`) | `ledger.ts:746` | Already renders an **unresolvable pointer** honestly. The `{producedBy, executionId}` stub is the engine's evicted impulse (SEAM_MAP_2026-08-21: `evictExecutionScope` clears the store before the walk reads its outputs). |
| `renderPolicy` (`formByShape`, `learnedFormByShape`, `maxPreviewChars`, `presentation`) | `src/store.ts:588-618` | Law-1 steering. |
| Form learner (demote-only) | `src/form-learn.ts` | Tier 2. Open gaps: `the-form-learner-has-no-variance-source-so-it-can-only-demote` and `form-decision-corpus-has-no-reader-learned-form-by-shape-has-no-writer` (the latter was filed on 09-30, the same day `e2bcb509` committed the learner; re-check its status against that commit). |
| Interaction contract (Choice / Score / Noul / Text, one write builder) | `ui/src/lib/interaction.ts`, `components/Interaction.tsx` | Output 2's widgets. |
| Discovery fan-out allowed only for `vesselCapability` | `src/routes/proxy.ts` (`isCapabilityPointer`) | The read-vs-run boundary of C2, on one route. |

### 3.2 Where it is a dispatch-record viewer

| Site | What it reads | Contract gap |
|---|---|---|
| `RunView.tsx:188-251` | `goalWalkState`: verdict, `goalReachReason`, `answerBody`, Trace | The whole run is one dispatch-record read. Nothing is addressed by impulse. |
| `Trace.tsx:144` → `fromLedgerEntry` | `poolProvenance[]` joined with `poolEvents` | The preview is ≤2,000 chars and covers the **last walk only**. Records beyond the newest 100 are blanked (`pruneStore`). `producedBy` is the constant `"goal-host-walk"`. |
| `attempts.ts` (sessionStorage `sf.attempts.<id>`) | Earlier attempts' previews, **only in a browser that watched** | It is a client-side store that compensates for missing server retention. It is honest about this ("content not retained"), but it is not provenance. |
| `bestOutput.ts` + `BestOutput.tsx` (uncommitted, another session) | `HOLLOW-CONTENT` 400-char `walkLog` excerpts, browser copies, pool previews | Violates C1 (scrapes log strings) and C4 (hardcoded `NOT_OUTPUT` / `EVIDENCE` shape sets). It is the right *interim* product (5-delivery P1) and should be labelled as the stopgap it is. |
| `RunRow.tsx:117`, `RunView.tsx:206` | `activeDispatches.goal` | "goal text not recorded" on **35/50** newest rows. All 35 have `operator: null`; the 5 rows with an operator all carry goal text. The goal is the run's first impulse and has no addressable record. |
| `/api/resolve` (`proxy.ts:671`) | Forwards **any** body to goal-host's `/resolve` with the fleet key | Unlike `/api/discovery/resolve`, there is no read-only boundary. **A dispatch is reachable through it by construction.** `/api/run-goal` (`proxy.ts:654-669`) is `resolveThrough(cand, JSON.stringify({...req, type: "goalDispatchAsync"}))`, and `/api/resolve` (`:671-676`) is the same `resolveThrough` with the caller's body unchanged. So `POST /api/resolve {type:"goalDispatchAsync", goal:…}` dispatches a walk with the fleet key, with no `operator` or `tags` the surface would add. The same holds for any other executing shape goal-host serves. This was established from source, not by probe. It is a C2 violation and the same §9.0 family as the unauthenticated write routes. |

### 3.3 The learned-pathway case: the dispatch record has nothing, the trace has the chain

Newest 50 `activeDispatches` (~07:50Z 10-02), each followed by a `goalWalkState` read through
`:18310/api/resolve`:

| `executionPath` | dispatches | with `poolProvenance` |
|---|---|---|
| `learned_pathway` | 29 | **0** |
| `satisfier` | 9 | 9 |
| `fresh_derivation` | 11 | 5 |
| `feature_compose` | 1 | 0 |

A learned-pathway run (`exec_dj16h7l3`, `selectedTemplateId: ribosome-extract`, `reached: true`) has
`steps: 0`, `walkLog: 2`, `poolShapes: []`, no goal and no answerBody. Its trace (`GET :8080/v2/activities/
execution-traces/exec_dj16h7l3`, authenticated) holds the chain:

```
acquire_trace_signature  → out resolve:executionTraceWithSignatures_ffirkkh3 (executionTraceWithSignatures)
assess_quality           ← in  …ffirkkh3                          → out dev:llm_completion_dispatch_zfobal8n (qualityScore)
synthesize_template      ← in  …zfobal8n, …ffirkkh3                → out …5ek12x73 (extractedTemplate)
validate_proposal        ← in  …5ek12x73                          → out …xoxorquq (validation_result)
dispatch_write_attempt   ← in  …5ek12x73, …xoxorquq                → out resolve:activityTemplate_write_zj9t6pro (writeAttempt)
dispatch_write_succeeded ← in  …zj9t6pro, …5ek12x73                → out noop_6pwskjrh (activityTemplate)
emit_summary             →                                          out …6rqyapc0 (learningSummary)
trace level: input_impulses [], output_impulses null, completion_shapes [activityTemplate, learningSummary]
```

This is the goal → evidence → answer graph the contract needs, as ids with real edges. No id is
addressable and no content is attached. For 29 of these 50 runs, the trace is the only structured
account of what happened.

### 3.4 The stores a reference could resolve against

| Store | Contents | Usable as the content record? |
|---|---|---|
| goal-host dispatch record (`/workspace/goal-host-dispatches.json`) | ≤2,000-char previews, last walk, newest 100 only | No. It is a preview cache (1-storage-map, 5-delivery §1.3). |
| activity-api `impulse` table (`POST /v2/impulses`, `GET /v2/impulses/:id`) | **112,976** rows over 6 shapes, all bookkeeping: `cluster_shadow_decision` 77,603, `conceptUpkeepAuditLog` 25,566, `environmentBaseline` 8,024, `operationalStateSnapshot` 1,146, `upkeepAuditLog` 493, `falsifierBaseline` 144. Fields: `pointer, shape, summary, metadata, budget, token_estimate`. **No `content` field.** 0 walk-output shapes. | It has the right *schema* for references (pointer + metadata, lazy). It has the wrong *population* and no content. `GET /v2/impulses/:id` on a known-present id (`cluster-shadow-1790812873244-ry71qq`) failed twice, for different reasons. **(a)** The first calls returned HTTP 000 while systemd stopped and started activity-api at 08:00:20Z. **I did not trigger that restart**, and its cause was not identified. **(b)** A retry made after `/health` answered 200 (08:00:28Z) still **hung ≥60s with no answer**. The restart does not explain (b). The negative is still unattributed, since slow-query gaps are open, but (b) is the cleaner one. I did not probe further. |
| Trace store (`execution` + `execution_trace_content`) | Shapes and task-level id edges; no content; `input_impulses` empty on 150,032/150,032 rows (B-pool-provenance §0.3) | It is the provenance graph, not the content. |
| activity-api `impulse.resolved` WS event | `{execution_id, task_id, impulse_id, shape, resolver_id, resolver_tier, vessel_id, latency_ms, cost_usd, body?(≤50 KB), timestamp}` (`websocket/types.ts:140-185`, emitted at `routes/execution-traces.ts:3043-3160` from `trace.impulse_resolutions[]` + `output_impulses[]`) | **This is the contract's input record, already specified.** In the live goal-host and ias-executor `src`, the only emitter of `impulse_resolutions` is ias-executor `hosts/vessel-daemon.ts:308`. Other vessels were not grepped, and `TranslatingTraceSink` was not located. goal-host's walk and floor sinks do not send it, so for a walk it never fires. It is also transient: a WS event, not a store. |
| development-vessel `poolImpulse` (`/workspace/pool/standing.json`) | Standing policy and context records (`id, shape, body, source, status`) | A different "pool" (trust-root records and operator context). The name collides with the walk pool. It is not a run's pool. |
| sessionStorage | Earlier attempts' previews | Per browser, not provenance. |

**Conclusion.** No store today holds `(executionId, impulse_id) → content` for walk outputs, so the
reference contract has nothing to resolve against. The schema exists twice: the `impulse` row and the
`impulse.resolved` event. Neither is populated by the path the human surface's runs take.

---

## 4. How a run should be presented under the contract

A run is the **chain of impulses** it consumed and produced, resolved by reference, with the trace as
their provenance. It is not a log.

```
┌ Goal ─────────────────────────────────────────── goal impulse (author, at, revision) ┐
│ "What's happening today, 1 Oct 2026?"                       you · 09:31 · dispatch 5bef… │
├ Answer ─ goal_answer (attempt 2 of 3 · not reached — judged HOLLOW: <reason>) ───────────┤
│ <Rendered content={ref → read(executionId, impulse_id)} density="full">                  │
│   4,965 of 4,965 chars · llm_completion · produced by satisfier:llm_completion · 09:33    │
├ Evidence (consumed by the answer) ───────────────────────────────────────────────────────┤
│ ▸ web_search   12 results · 3,402 chars · local-tools · 09:32        [row density, lazy] │
│ ▸ http_fetch   aljazeera.com · 11,430 chars (first 2,000 retained)    [row density, lazy] │
├ Other produced impulses (not consumed) ──────────────────────────────────────────────────┤
│ ▸ memoryNote_write  1 item · development-vessel                                            │
├ Provenance ─ trace exec_… (7 tasks) · pathway: fresh_derivation · attempt 2 of 3 ────────┤
│ the walk log, verbatim, one line per entry (unchanged: a log is a log)                   │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

The rules, each of which follows from §2:

- **Order comes from edges, not from time or log position.** The answer is the impulse with
  `role: answer` (or a completion shape). Evidence is its `consumedIds`. Everything else produced is
  listed under "other produced impulses". The edges come from the trace's task records, with B4's
  "declare consumption only when bound" applied so an edge means binding (B-pool-provenance §5).
- **Lazy by density.** A `row` shows metadata only: shape, summary, size, producer, at. This is
  WORKBENCH_CHAIN_UX §2 and sequences/02 pointer mode. Expanding a row reads the content by id.
  `row` density already records no form decision, which stays correct.
- **Attempts are first-class.** Each walk within a dispatch is an execution with its own chain. The
  reported attempt leads. Others are navigable rather than overwritten (open gap
  `goalwalkstate-discards-prior-walk-attempts-within-a-dispatch`).
- **The verdict sits on the answer impulse, not on the page.** "not reached — judged HOLLOW" is
  rendered as a property of the answer it judged. A grade is written against `(executionId,
  impulse_id)` of the impulse the person read.
- **The walk log becomes provenance detail.** It stays a verbatim list, as design.md §1a already
  rules, and is never mined for content.
- **The same projection serves every path.** A learned pathway (§3.3), a satisfier, a fresh
  derivation and the floor all present through the same chain view. The floor needs B3 (its tool
  calls as pool impulses with edges) before it has a chain.

`bestOutput.ts` is then deleted rather than extended. "Best output" becomes "the answer-role
impulse of the reported attempt", which is a lookup, not a heuristic.

---

## 5. Doc-vs-code and doc-vs-doc divergences

| # | Divergence | Kind |
|---|---|---|
| D1 | `do-anything-surface` §3.0 and `surface-render-contract` (`fromProvenance`) make the dispatch record's `poolProvenance` "the evidence ledger". FOUNDATION and sequences/02 say an impulse is a lazy pointer resolved on demand, and that nothing truncates. | **By-design divergence between two openspecs and the foundation.** The openspecs should say so and name the record they would read instead. |
| D2 | sequences/02 says "There is no content-truncation step … a silently truncated impulse would make a downstream failure unattributable". goal-host truncates with `contentPreview` at 2,000 chars, `poolDigestHuman` with `slice(0,1500)` and Basis with `slice(0,3000)`, both **unstated**, and HOLLOW-CONTENT lines at 400 chars (5-delivery §1.1). | Doc describes the engine; goal-host's mirror violates its rationale. |
| D3 | HUMAN_PARTICIPATION tier 1, "declared by the producer in the impulse metadata": no producer declares, and the planner receives no metadata. | Documented trajectory, unbuilt. The doc says "expected trajectory", so this is honest. |
| D4 | design.md §2: `Content.provenance` has `executionId`. Code (`content.ts`) has `producedBy, source, at` only. | Code behind its own spec. |
| D5 | CLAUDE.md "Interaction surfaces": "Human: Obsidian vessels". The live primary human surface is human-surface-vessel (`:18310`), and `obsidian:write_note` has 0 producers (per D-delivery-targets and 5-delivery §2.1, 10-01; not re-measured here). | **CLAUDE.md is stale (law 9).** It should name the human surface as a vessel and Obsidian as one surface among several. |
| D6 | SUBSTRATE_AS_SOFTWARE:137 says stateful-ui-vessel "owns `uiPanel`/`uiQuestion`/`interactor*` — the substrate's 'face'". human-surface-stack §4 retires it. It is still live and first in discovery for `uiPanel_write` (§9.4: retirement is a user decision). | Doc stale on either outcome. It should describe the role by shape, not by vessel name. |
| D7 | FOUNDATION: "Trace = a recorded set of impulses (inputs, intermediates, outputs)". The live trace keeps shapes and engine ids; `output_impulses: null`; `input_impulses: []` on 150,032/150,032 rows. | The trace is a record of shapes and edges, not of impulses. |
| D8 | EXPLICABILITY: "A truncated preview links to a complete artifact or explicitly says that the full artifact is unavailable." The surface does the second ("first N of M chars", "content not retained"). There is no first option to offer. | Honest degradation. The contract supplies the link. |
| D9 | `bestOutput.ts` keys on shape names (`NOT_OUTPUT`, `EVIDENCE`). That contradicts the surface's own ruling (design.md, "dispatch on form, never on shape") and law 1. | In-grant code drift (uncommitted). |
| D10 | `impulse.resolved` is documented as the WS-level contract for resolved content (`types.ts:140`). goal-host walks never emit `impulse_resolutions`. | An organ built and unwired for this path. |

---

## 6. Prior art (searched before proposing)

- **react-renderer** (`repos/react-renderer`, 3 commits; retired by human-surface-stack §4 "read
  `src/primitives/` first"):
  - `shape-slot.tsx` is a placeholder that fills when a shape resolves, with a provenance strip.
  - `activity-api-subscriber.ts` built primitives from `impulse.resolved` WS events, keyed by shape
    through `shape-mapping.json`.
  - ARCHITECTURE.md: "UI State IS Impulse State", "Delegation, Not Ownership — resolves pointers to
    data owned by other vessels".
  - Last time, it consumed the right event and dispatched on **shape** (a renderer-per-shape table).
    do-anything-surface rejected that half, correctly. The event-consuming half was dropped with it.
- **stateful-ui-vessel**: panel and question store (`uiPanel_write`). Still live (§9.4).
- **obsidian-vessel `src/views/goal-dispatch-view.ts`**:
  - It is also a `goalWalkState` poller. It renders `steps` as a tree plus `answerBody`.
  - "Open trace" dumps `activityExecutionTrace` as JSON (`:662-671`).
  - The same dispatch-record-viewer pattern, with the trace one click away as raw JSON.
- **minibob** (`repos/deployment/vessels/minibob/src/impulse.ts`): the origin of the
  `loaded / budget / content` lazy impulse, and the "loaded summaries" idea that sequences/02
  documents.
- **ias-executor `bf5c691`** (08-25): "materialize `loaded:false` inputs, never drop them silently". It is
  the lazy-resolve precedent on the LLM-input side. It fails open with a lifecycle event.
- **SEAM_MAP_2026-08-21** (`33520eab`): "the impulse body dies at hop 4". `evictExecutionScope` clears
  the engine store before the walk reads outputs, so the walk pools a `{producedBy, executionId}`
  stub. This is the same seam that makes content unaddressable after a run.
- **INTERACTABLE_HORIZON_2026-09-06**:
  - It measured 16/50 rows with neither goal nor executionId, and answerBody null on 47/50.
  - Its verdict: "a data-capture defect surfacing as a UI defect. No layout change fixes it; re-rendering
    a null produces a prettier null."
  - It filed `a-third-of-the-board-is-rows-a-human-cannot-read`,
    `the-runs-column-conflates-who-asked-with-how-it-fired` and
    `the-surface-has-a-render-architecture-and-no-selection-architecture`. **None of the three is in
    the live gap store** (6,856 rows) **or in the frozen `/workspace/gaps/gaps.json`**. They are lost,
    not closed.
  - Today the goal-null count is 35/50.
- **render-learning.md**: the "what to surface" decision should reuse `impulseRelevance`, keyed
  `(activity, pointer-shape)`. That needs impulse references to key on.
- **HUMAN_PROJECT_LIFECYCLE_ASSESSMENT_2026-09-21**: "Join presentation, response, consumption, and
  effect", the resumable inbox. Same join, from the participation side.
- **Prior reports, this realignment:**
  - 5-delivery-to-surface (P1 best-output block, P2 delivered lane HELD, P3 retention and always-built
    answerBody).
  - B-pool-provenance-and-trace (B1 one pool object with real `producedBy` and unique ids, B2 real
    edges, B3 floor impulses, B4 bound-only consumption).
  - APPROACH D (always build answerBody; delivery-by-origin HELD per §9.5).
- **`git log -S`:**
  - `contentRef`: only activity-api `aa258e3` (schemas).
  - `impulseRef`: docs and templates only.
  - `resolveImpulse`: docs and engine interpolation.
  - **No prior attempt at a by-id content read for the surface.**

What happened last time: each surface attempt read whatever record was nearest. react-renderer read WS
events, keyed by shape. stateful-ui read panels. human-surface reads the dispatch record. The
Obsidian plugin reads the dispatch record plus raw trace JSON. None obtained an addressable content
record, because none exists for walk outputs. Each built honest rendering on top of the record it
had.

---

## 7. Gap list (contract → missing piece)

| # | Gap | Owner | Filed? |
|---|---|---|---|
| G1 | No durable, unique `impulse_id` for walk-pool members; engine ids are not resolvable | goal-host (coordinator) | B-pool-provenance B1 (proposal); not a gap row |
| G2 | No content record keyed `(executionId, impulse_id)` survives the walk | goal-host / activity-api (coordinator) | Partly: `goalwalkstate-discards-prior-walk-attempts-within-a-dispatch` (last-walk only) |
| G3 | `producedBy` is a constant; `consumedIds` absent on the pool | goal-host (coordinator) | B1 / B4 proposals |
| G4 | goal-host does not emit `impulse_resolutions` / `impulse.resolved` | goal-host (coordinator) | **Not filed** |
| G5 | No shape reads an impulse reference by id (the `impulse` table has a REST route, no shape, and did not answer in 60s) | activity-api (coordinator) | **Not filed** |
| G6 | The goal text is not an addressable impulse (35/50 rows have no goal) | goal-host (coordinator; tracks 1/2 own the cause) | The 09-06 gap is lost |
| G7 | `Content` lacks `executionId`/`impulse_id`; the planner gets no metadata (no `declared` tier) | surface | No |
| G8 | `bestOutput.ts` scrapes logs and keys on shape names | surface | No (uncommitted work) |
| G9 | `/api/resolve` forwards executing shapes to goal-host with the fleet key | surface + §9.0 | No |
| G10 | Responses carry no target impulse id and no authenticated author | surface + identity (§9.0) | §9.0 family |
| G11 | CLAUDE.md and SUBSTRATE_AS_SOFTWARE:137 name the wrong surface | docs (docs-align loop) | No |

---

## 8. Proposals

Every proposal below is a **read by id**. None selects a delivery target or asserts an origin, so
none depends on §9.0's held items, except P8, which is the §9.0 item itself. Builder labels follow
REALIGNMENT §2.0: goal-host `index.ts` is excluded, so (a) is operator bootstrap.

### Inside the surface grant

**P1. Carry the reference in `Content` and make the run view a chain projection over whatever
references exist.**

- **Seam:** `ui/src/lib/content.ts` (`Content.provenance += { executionId, impulseId, consumedIds,
  attempt }`, plus `ref?: ImpulseRef`), `fromLedgerEntry` / `fromProvenance`, and `Trace.tsx`,
  `RunView.tsx`.
- **Change:**
  - Adapters fill the new fields when the wire has them, and leave them absent otherwise.
  - The run view groups by role (answer, evidence, other) when edges exist, and falls back to
    today's list when they do not.
- **Gate (deterministic):** a `Content` whose `ref` is present is never built from a `walkLog`
  string (static check on adapter call sites).
- **Verification:**
  - **Positive:** a fixture `goalWalkState` with `poolProvenance` carrying `impulseId` and
    `consumedIds` renders answer-then-evidence.
  - **Must-fail:** today's live record (no ids) renders exactly as now (snapshot parity); no edge
    is invented.
- **Status:** new as a surface item. It extends `surface-render-contract` design §2, which already
  lists `executionId`. It lights up when P3 / P4 land.

**P2. Retire shape-keyed choice from `bestOutput.ts`.**

- **Seam:** `ui/src/lib/bestOutput.ts` (`NOT_OUTPUT`, `EVIDENCE`).
- **The record cannot supply the split where `bestOutput` runs (measured).** `bestOutput` runs only
  when `reached !== true`. Of the newest 12 non-reached dispatches (~08:10Z 10-02), 5 carry
  provenance. Of those 5, `completionShapes` is non-empty on 2 and `[]` on 3, and `pendingTargets`
  is non-empty on 1. A gate built on `completionShapes` would be vacuous exactly where the code runs.
- **Change:** move the shape lists into `renderPolicy` as a pin-like field
  (`outputRoleByShape: {shape: "bookkeeping" | "evidence"}`), so the list is a shaped impulse read
  at use time, steerable through `surfaceIntent`, and learnable later.
- **Coordinator ask:** serve the walk's inferred `targetShapes` on `goalWalkState` for every walk.
  Then the answer role is a fact on the record, not a policy guess, and P1's role grouping can use
  it.
- **Gate:** no `Set` of shape-name literals in `ui/src/lib` outside `renderPolicy` reads. This
  extends the P9 / P11 static-check style in `packages/interaction-conformance`.
- **Verification:**
  - **Positive:** cea3f4a4-style fixture still picks the attempt-2 excerpt, with the lists supplied
    by a fixture `renderPolicy`.
  - **Must-fail:** with an empty `outputRoleByShape`, a bookkeeping shape is not silently excluded.
    The choice falls to the longest output and says so.
- **Owner:** the session that owns the uncommitted work. Flag it, do not edit.

**P3. Close the read-vs-run boundary on `/api/resolve`.**

- **Seam:** `src/routes/proxy.ts:671`.
- **Change:** an allowlist of read shapes (`goalWalkState`, `activeDispatches`, and the future
  reference read) mirroring `isCapabilityPointer`. Dispatch stays on `/api/run-goal`.
- **Gate:** any other `type` → 400 with the reason stated.
- **Verification:**
  - **Positive:** both read shapes still answer through the proxy.
  - **Must-fail:** `{type:"goalDispatchAsync"}` and `{type:"llm_completion"}` through `/api/resolve`
    each return 400 and never reach goal-host. Assert this in an isolated test with a stub upstream
    that counts calls (0 calls), never against the live goal-host.
- **Status:** new. It respects §9.0, and narrows an existing path rather than adding one.

**P4. Tier `declared` in `planContent`.**

- **Seam:** `ledger.ts:840`. Add an optional `declaredForm` argument read from the reference
  metadata (`contentForm`). Order: pin → learned → **declared** → heuristic.
- **Gate:** `decidedBy: "declared"` appears only when the metadata carried it.
- **Verification:**
  - **Positive:** a fixture with `contentForm: "rows"` on a prose-looking body renders rows.
  - **Must-fail:** a pin overrides it; an unknown form value falls to the heuristic.
- **Status:** HUMAN_PARTICIPATION tier 1, unbuilt. It lights up when producers declare (P7).

### Asks to the coordinator (not edits)

**P5. Make walk outputs addressable: one content record per pool impulse, keyed
`(executionId, impulse_id)`.**

- **Seam:** goal-host `mkImpulse` / `addToPool` / `mirrorWalkState` (`index.ts:7543-7562`,
  `9808-9837`). This is B1's factory.
- **Change:**
  - Write each impulse's content once to a store, as an extension of the open
    `goalwalkstate-discards-prior-walk-attempts-within-a-dispatch` repair.
  - The bound per impulse is **stated** (in the spirit of the floor's 4,000 +
    `…[truncated N chars]`), not silent.
  - Serve it by a read shape.
- **Prefer existing organs (law 3):** the activity-api `impulse` table already has the reference
  schema (`pointer, shape, summary, metadata, token_estimate`). Add `content` (or a content-addressed
  blob pointer) and a **read shape** over it. Do not add another REST route or another table.
- **Gate:**
  - every `poolProvenance` entry carries an `impulseId` that the read shape returns with
    `chars` equal to the provenance `chars`;
  - `producedBy ≠ "goal-host-walk"`.
- **Verification:**
  - **Positive:** a new walk's every impulse resolves by id.
  - **Must-fail:** today's records (14/14 constant `producedBy`; 0 walk ids in the table), and a read
    of an id from another dispatch returns not-found, not a collision (today `walk-<shape>-<n>`
    collides).
- **Status:** extends B1 and the open gap. "Read shape over the impulse table" is new.

**P6. Emit `impulse.resolved` (with `body`) from goal-host's trace sinks.**

- **Seam:** `persistSatisfierTrace` / `buildCompositeTraceFromChain` (`index.ts:6684`, `6981`).
  Populate `impulse_resolutions[]` and `output_impulses[]` with bodies, as `vessel-daemon.ts:308`
  does.
- **Effect:** activity-api's existing broadcaster then carries the content to any subscriber,
  including the surface's live run view.
- **Gate:** for a walk with N pool impulses, the trace ingest emits N `impulse.resolved` events whose
  `impulse_id` matches P5's ids.
- **Verification:**
  - **Positive:** subscribe to `/ws` by execution id during a satisfier walk and receive the
    `llm_completion` body.
  - **Must-fail:** no event for a stub (`{producedBy, executionId}`) carries a `body`.
- **Status:** **already built** on the activity-api side (`types.ts:140-185`, `execution-traces.ts:3043+`).
  The ask is only the emitter.

**P7. Producers declare `contentForm` (optional) and `stop_reason` in impulse metadata.**

- **Seam:** the resolver envelope (`{success, shape, body, metadata}`) at llm-resolver / local-tools /
  development-vessel.
- **Owner:** coordinator.
- **Why:** it feeds P4 and §9.2's abstain-on-cut.
- **Status:** new, small. Defer until P5 exists, or the metadata has nowhere to ride.

**P8. Responses addressed and authored.**

- Grades, feedback and solicitation responses gain `target_impulse_id` (when P5 exists) and a
  server-stamped `author` from the authenticated caller.
- **Status:** already §9.0 / §9.5 (route auth first) and 5-delivery P2 preconditions. Listed so the
  contract names it. **HELD** behind route authentication.

**P9. Re-file the three 09-06 surface gaps that are missing from both stores.** Re-file
`a-third-of-the-board…`, `…conflates-who-asked…` and `…render-architecture-and-no-selection…`,
with today's measurement (35/50 goal-null) as their falsifier. This is a gap-ledger write, so it is
coordinator-owned.

**P10. Docs alignment (docs-align loop).**

- CLAUDE.md "Interaction surfaces" and SUBSTRATE_AS_SOFTWARE:137 describe the human surface by role
  and shape, not by vessel name.
- `do-anything-surface` §3.0 and `surface-render-contract` §2 add a note: `poolProvenance` is an
  interim preview cache, and the target is the reference read (§2.1 here).

**Detector (law 6).** One §2.1 evaluator row: "every `goalWalkState` provenance entry for a terminal
dispatch younger than the retention window carries an `impulseId` that resolves by read with
matching `chars`."

- **Must-fail today:** 14/14 entries carry no id.
- It would also have caught the 09-06 lost-gap class (a run whose content is unreadable), from the
  data side rather than the UI side.

**Order:** P3 (independent, safety) → P1 + P2 (surface, no dependency) → P5 → P6 → P4 + P7 → P8 (after
§9.0 route auth).
