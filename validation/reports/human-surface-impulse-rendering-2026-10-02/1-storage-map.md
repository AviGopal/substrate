# Track 1: where a run's data is stored, from dispatch to answer

Read-only, 2026-10-02 07:45–08:04Z, node 1 (`substrate-live`). Nothing was dispatched, written, restarted or committed.
The only POSTs were SurrealDB `/sql` SELECT/INFO statements and read-shape resolves (`activeDispatches`, `goalWalkState`,
`activityExecutionTrace`, `goal_verification_label`, `goalExecutionPath`, `vesselCapability`). Temporary files were deleted.

**Sources.**
- Live goal-host `/vessels/goal-host-vessel/src/index.ts` (line numbers below refer to the live file).
- Live dispatch store `/workspace/goal-host-dispatches.json`. It held 2,001 records spanning 2026-09-28T03:17Z → 10-02T07:39Z, about 3.2 MB.
- SurrealDB `activity-system/learning_loop`.
- activity-api `/v2/impulses/resolve` and `GET /v2/activities/execution-traces/:id`, called in-container with a vessel key.
- discovery `/registry/shapes` (407 shapes) and `vesselCapability` resolves.
- human-surface source `repos/human-surface-vessel/{src,ui/src}`.
- Gap store `/workspace/git/super-repo/gaps/gaps.json` (6,856 rows).

Every count names its denominator and its window.

---

## 0. Prior art: what was tried before, and how it went

| What | Where | What happened |
|---|---|---|
| Evidence ledger: a 2,000-char `contentPreview` per pool impulse on the dispatch record | goal-host `ced125b` (causal-intent), `mirrorWalkState` `index.ts:9817-9851` | **Still live.** It is a preview only, it keeps the last walk only, and it is blanked by `pruneStore` past the newest 100 records. |
| `pruneStore`: blank past 100, delete past 2,000 | goal-host `index.ts:17880-17894`. Inventoried as a decision cap in `realignment-2026-09-29/hardcoding/C-decision-caps.md` | Unchanged. The constants are in-process (law 1). |
| Floor answer persisted to the trace (`metadata.final_text`, 4,000-char cap) | goal-host `index.ts:5568-5592` (the "PERSIST THE ANSWER" comment, 08-09) | **Held.** 1,875/1,875 retained floor rows carry it (§2.2). |
| Satisfier traces record their input and output impulse ids | gap `satisfier-traces-record-no-input-impulses-…` **closed** by mitosis cutover `69fe835` (09-23) | **Partial.** The ids are recorded at task level only. 479 of 7,141 satisfier rows carry task input ids, and 6,281 of 7,141 carry task output ids. Row-level `input_impulses` is still empty on every row. The ids are not resolvable (§2.3). |
| `goalWalkState` keeps the earlier attempts within one dispatch (`priorAttempts`) | gap `goalwalkstate-discards-prior-walk-attempts-within-a-dispatch`, **open** since 09-30. Surface-side mitigation in `b0767021` (keeps what it saw while watching) | Open. For an unwatched run, every attempt but the last renders as "content not retained". |
| `goal_answer` and `human_presentation` pool shapes | `9a9fef6` (07-07), `a72ad1a` (07-26) | Emitted **only on reach**, into a pool that dies with the walk. `agentic-floor/B-pool-provenance-and-trace.md` §4 measured **no reader** for them, and I did not re-measure that. |
| Pool ids are not durable | `agentic-floor/B-pool-provenance-and-trace.md` §0.4 | Confirmed, and extended: the ids are not **unique** either (§2.3). |
| Retention table for the dispatch store | `output-shapes/5-delivery-to-surface.md` §1.3 | Re-measured below. Same shape, 24 h later. |
| No walk has ever delivered content to the surface as a panel | `output-shapes/5-delivery-to-surface.md` §2.2 | Re-checked: 0 of 35,886 journaled `uiPanel_write` lines mention a dispatch id or `goal_answer`/`human_presentation`. |
| Durable standing pool | development-vessel `resolvers/pool-impulse.ts` (`poolImpulse` / `poolImpulse_write`) | **Exists, but walks do not use it.** It holds 4,834 records in 10 shapes, all substrate bookkeeping, none run content (§1). Gap `pool-impulse-write-accepts-shapeless-null-body-records` is open. |
| Impulse-table writers | `INSERT INTO impulse`: activity-api `routes/impulses.ts:280,495`, `routes/activities.ts:7503`; concept-db `resolvers/impulse.ts:101`; development-vessel `causal-adjudication.ts:219,374`, `operational-state.ts:501` | **None of them is called from the walk.** goal-host has no impulse-table writer. |

Two related open gaps: `lost-reached-verdict-walk-satisfier-*` (a reach-patch matched no execution row) and `the-walk-pools-non-write-output-under-write-shapes-…`.

---

## 1. The map

"Addressable" means a shape plus a pointer that some resolver answers after the run has ended. Every "yes" or "no" below has a live read behind it in §2.

| Datum (what a person reading a run wants) | Where it lives | Size / cap | How long | Addressable after the fact as an impulse? |
|---|---|---|---|---|
| **Goal text** | Dispatch record `rec.goal` (`index.ts:16374`), full length. `activeDispatches` slices it to 200 chars (`index.ts:127`). Also in `goal_execution_paths.goal_text` (23,063 rows, keyed by `goal_hash`) and `goal_verification_labels.goal` (14,688 rows, keyed by `execution_id`). | Full in the record. | The record lasts until it is the 2,001st newest (about 4 days at the current rate). Path and label rows persist. | **Partly.** `activeDispatches` and `goalWalkState` carry it until deletion. `goal_verification_label` answers by `execution_id` (positive control below). The `goal` shape is a writer: it 400s without `content`. **For 801/2,001 records there is no goal text anywhere** (§3). |
| Pinned target and variables (what a goal-less run actually *was*) | The request body only. The record keeps neither `targetTemplateId` nor `variables` nor `tags` (`index.ts:16374`). The trace row keeps `metadata.dispatch_target_template_id`, plus `tags` that include `dispatch:<id>` and the caller's tag (e.g. `ribosome-vessel-dispatch`). Trace `input_state.variables` is `{}`. | n/a | The trace row's lifetime. | Template id: yes, via the trace. **Variables: nowhere.** |
| Verdict (`reached`, `goalReachReason`) | Dispatch record. Also the trace tags `reached:*` and `goal_verification_labels`. | Reason is a string. | `reached` is on 2,001/2,001 records and `goalReachReason` on 1,268/2,001. Both survive compaction. | Via `goalWalkState` / `activeDispatches` until the record is deleted. Via `goal_verification_label` (by `execution_id`) indefinitely. |
| Step decision tree (`steps`, `walkLog`) | Dispatch record. `walkLog` is `stepSink.slice(-60)` (`index.ts:9853`). `goalWalkState` re-slices it to 60 (`index.ts:17259`). | 60 lines. | **Blanked past the newest 100**: 1,900/2,001 are `compacted:true`, about 8 h of runs at the current rate. | Only while in the newest 100, and only for the **last** walk in the dispatch (open gap above). |
| **Each step's output content** | In-process `poolImpulses` (`index.ts:7544-7563`) holds full content for the walk's lifetime. Dispatch record `poolProvenance[].contentPreview` keeps 2,000 chars per shape, first-producer-wins per shape (`addToPool` returns early if the shape is already present, `:7561`). | 2,000 chars. 19 of 165 previews retained in the store were truncated, and the largest original was 396,341 chars. | **Content dies with the walk.** The preview dies at compaction (100). In the newest 100, only 24 records have any `poolProvenance`. | **No.** The pool id `walk-<shape>-<n>` is not in the `impulse` table and is not unique (§2.3). The trace keeps the shape names and those ids only. |
| Pool event log (`poolEvents`) | Dispatch record. Capped `.slice(-64)` at `index.ts:7558`. Accumulates across walks. | 64 entries of `{shape, source, at}`, with no content. | Blanked at compaction. | No. |
| **Answer** (`answerBody`) | Dispatch record. Built only on reach (`index.ts:11458`, floor `:5617`). | Max 6,208 chars, mean 1,177 (n=169). | **Survives compaction**: 155 of the 1,901 records past the newest 100 carry it. Deleted at 2,000. | Through `goalWalkState` / `activeDispatches` until deletion. As a `goal_answer` / `human_presentation` pool impulse: **no**, because the pool dies with the walk. |
| Floor answer (`final_text`) | `execution.metadata.final_text` (`index.ts:5591`). | 4,000-char cap, with the truncation stated in the text. | Trace retention (`execution` ≈ 150K rows). | **Yes, with conditions.** It resolves via `activityExecutionTrace` only when the pointer uses the SurrealDB record-literal form and asks for `format:"json"`. The default markdown omits `final_text`. `GET /v2/activities/execution-traces/<bare id>` also returns it (§2.2). |
| Floor tool calls and observations | Nowhere. `metadata.tools_total = 0` on 1,875/1,875 floor rows. 0 of those rows has an `execution_trace_content` row (B §0.2; I did not re-measure). Journal, last 24 h: 26 `floor: ENTER`, 23 `floor: persisted`. | n/a | n/a | No. |
| Trace structure (activity, tasks, shapes, ids) | `execution` (150,327 rows, `created_at` 08-23 → 10-02) and `execution_trace_content` (237,010 rows, per-task `input_impulse_ids`, `output_impulse_ids`, `resolved_config`, `tool_calls`). | ~1.5 KB per row. **No impulse content.** | Retention sweep, with a global ceiling of about 150K (B §0). | **Yes** via `activityExecutionTrace` / `GET execution-traces`. The dispatch↔trace join is the `dispatch:<id>` tag, present on 73,287/150,327 rows. |
| Evidence the judge read | Not stored as content. The reach reason quotes fragments. | n/a | n/a | No. |
| Timestamps | `startedAt` and `endedAt` on the record (`endedAt` on 1,359/2,001). `created_at`/`executed_at` on the trace. `poolEvents[].at` until compaction. | n/a | As above. | Via the record or the trace. |
| Path learned for the goal | `goal_execution_paths`: `goal_text`, `path_activities`, `endpoint_output_shapes`, Thompson α/β. | n/a | Persistent (last update 10-02T07:58Z). | `goalExecutionPath` needs a target shape: a pointer of `{goal_hash}` 400s with "requires a target shape". |
| Human labels | `goal_verification_labels` (14,688 rows, last 10-02T07:44Z). | `notes` free text. | Persistent. | **Yes**: `goal_verification_label {execution_id}`. Positive control: `exec_yt1yt1sd` returned 1 row. `exec_dj16h7l3` returned 0, a true absence, because the same address answers for a known-present id. |

**Other stores that hold content (by producer):**

| Store | Path or table | Live size | Run content? |
|---|---|---|---|
| Standing pool (development-vessel) | `/workspace/git/super-repo/pool/standing.json` (written 10-02 07:58) | 4,834 records: `boredomSelectionSnapshot` 2,917, `substrateGap` 1,877, rhythms, trust roots, 16 shapeless | No. |
| memoryNote (development-vessel) | `/workspace/git/super-repo/memory/notes.json` | 89 notes | Only when a walk writes one. A re-frame's note lands here unseen by the surface (5 §3). |
| concept-db | `concept` table, 91,094 rows | n/a | Only for bridged question answers (`concept_create_write_result`, `index.ts:11577`). |
| `impulse` table (activity-api) | SurrealDB `impulse`, 112,975 rows. Fields: `pointer, metadata, summary, shape, budget…`, **no content column** | 6 shapes: `cluster_shadow_decision` 77,603, `conceptUpkeepAuditLog` 25,566, `environmentBaseline` 8,024, `operationalStateSnapshot` 1,146, `upkeepAuditLog` 493, `falsifierBaseline` 144 | **None run-related.** |
| Legacy and empty tables | `activity_execution_traces` 18,135 (dead since 07-14). `execution_traces`, `impulse_data`, `goal_execution_path`, `llm_resolution_log`, `tool_usage`, `routing_trace`, `execution_state_snapshot`, `impulse_usage_history`, `relevance_feedback`: 0 rows | n/a | No. |
| web_search (local-tools) and llm_completion (llm-resolver) | No store. `llm_router_decisions` (162 rows) holds router α/β only. | n/a | **Stateless.** Once the walk dies, the only copy of a search result or an LLM output is the 2,000-char preview. |
| human-surface | In-memory panels and feedback, journaled to `/workspace/git/super-repo/interactor-log/`. Line counts: `uiPanel_write` 35,886 (4.4 MB), `uiFeedback_write` 220,789 (51 MB), `renderPolicy_write` 37,740 (**141 MB**), `interactorObservation_write` 66,658 | n/a | No run content (0 dispatch ids). |
| stateful-ui | In-memory, unit active. 805 panels per REALIGNMENT §9.4 | n/a | No. |
| **Stale siblings** | `/workspace/pool/standing.json` (11,783 records), `/workspace/memory/notes.json` (680), `/workspace/interactor-log/*`. All last written 09-07 or 09-22, before `WORKSPACE_ROOT` moved to the super-repo clone. | n/a | Orphaned. This is the `WORKSPACE_ROOT` split named in REALIGNMENT §2.4. Not expanded here. |

---

## 2. Live reads (positive and negative controls through the same address)

### 2.1 Compaction (`goalWalkState` via `POST :18310/api/resolve`)
- Newest record `589cca50`: walkLog 9 lines. This is the positive control.
- 151st-newest goal-bearing record `a3ea906d`: walkLog 0, poolProvenance 0, steps 0, `reached:false` present.
- `GET :18210/executions/a3ea906d…` returns the verdict, the goal and `walkLog: []`, with no `poolProvenance` key.
- Store-wide counts:
  - Newest 100: 93 have walkLog, 24 have provenance, 14 have `answerBody`.
  - Older 1,901: 3 have walkLog, 2 have provenance, 155 have `answerBody`, 1,231 have `goalReachReason`.

### 2.2 The executionId on the dispatch record does not resolve through the shape
- `activityExecutionTrace {executionId:"exec_6d5vikum"}` returns **404 "not found"**. The row exists: a SELECT by record id returns it.
- With the pointer `"execution:exec_6d5vikum"` the same resolve succeeds.
- For a floor id, only `"execution:⟨universal-tool-fallback-…⟩"` (angle-bracketed) succeeds.
- The cause is the query `id = type::thing($execution_id) OR id = $execution_id` (activity-api `routes/impulses.ts:916-920`). A bare string never equals a record id.
- goal-host stores bare ids (`exec_…`, `universal-tool-fallback-…`) on every record, so **the id a reader holds is in the wrong form for the shape address**. This is a mis-addressed negative, not an absent row.
- `GET /v2/activities/execution-traces/<bare id>` does accept bare ids and returns `final_text`.
- The markdown format of the resolve drops `metadata.final_text`. `format:"json"` keeps it.

### 2.3 Pool ids are neither durable nor unique
- No `walk-…` id appears in `impulse`. Positive control: `impulse:⟨cluster-shadow-1783170168980-04yxlo⟩` returns its row through the same query.
- The `walk-…` ids are per-walk counters (`index.ts:7547`), so they collide: **5,366** `execution` rows list `walk-goal-1` among their input impulses.
- 7,329 `execution` rows have `walk-*` record ids. Of 7,141 satisfier rows, 479 carry task-level input ids and 6,281 carry task-level output ids. All of those ids are in the `walk-<shape>-<n>` form.
- Row-level `input_impulses` is empty on **150,327/150,327** rows (B measured 150,032; rows have been added since). `output_impulses` is non-empty on 55,815/150,327, holding ids such as `resolve:discoverByShapesQuery_…` and `dev:goal_file_extract_…`. None of those resolve: `resolve:discoverByShapesQuery_cwv4mx1d` returned 0 rows from `impulse`.

### 2.4 The surface can resolve only what goal-host's `/resolve` serves
- `human-surface src/routes/proxy.ts:671-676` forwards `/api/resolve` to goal-host only.
- goal-host answers 7 shapes (`index.ts:17353`): `goal_execution, activity_execution, activeDispatches, goalWalkState, poolImpulse_write, solicitationResponse_write, solicitationHeartbeat_write`.
- So `activityExecutionTrace`, `goal_verification_label`, `memoryNote` and `goalExecutionPath` are unreachable from the workbench even where they are addressable. Live read: `{"type":"registry_list"}` returned "unknown shape … supported: …".

---

## 3. Diagnosis: "goal text not recorded" on runs-rail rows

1. **Which field the rail reads.**
   - `RunRow.tsx:90` reads `row.goal?.trim()`, and `:117` renders the fallback "goal text not recorded".
   - `row` comes from `activeDispatches` (`ui/src/api/client.ts:197-202`), which goal-host builds from `executionStore` as `goal: typeof r.goal === "string" ? r.goal.slice(0,200) : null` (`index.ts:127`).
   - `RunView.tsx:206` does the same from `goalWalkState.goal`.
2. **Measured (`activeDispatches` at 07:59Z):**
   - 35 of the 50 newest rows have `goal:null`. 31 of those are `selectedTemplateId:"ribosome-extract"` and 4 have no template.
   - In the whole store, 801/2,001 records have no `goal` key: 311 `ribosome-extract`, and 490 with no `selectedTemplateId`.
   - All 490 of those carry the error "refusing pinned target development-vessel:scaffold-and-publish-vessel: learned posterior is decisively negative … [caller:dispatcher:unknown]".
3. **Why there is no goal text.**
   - These dispatches are **pinned-template dispatches with no goal text authored**. `POST /run-goal` accepts `{targetTemplateId, variables}` without `goal` (`index.ts:16288`).
   - ribosome-vessel sends exactly that (`ribosome-vessel src/index.ts:215-230`, `targetTemplateId:"ribosome-extract", variables:{executionId,…}`).
   - The record is built as `{dispatchId, startedAt, status, goal: typeof goal==="string" ? goal : undefined, reached, operator, trigger}` (`index.ts:16374`). **`targetTemplateId`, `variables` and `tags` are dropped**, so the record cannot say what the run was. The goal text was never written, so it was not lost.
   - The trace keeps half of it: `exec_dj16h7l3` (dispatch `9525e763`) has `metadata.dispatch_target_template_id:"ribosome-extract"` and tags `ribosome-vessel-dispatch`, `dispatch:9525e763-…`. Its `input_state.variables` is `{}`, so the extracted execution id (the run's real subject) is not recorded anywhere.
4. **Second symptom: misattribution.**
   - The trigger classifier (`index.ts:16335-16371`) has no rule for `ribosome-vessel-dispatch`, so these rows read `trigger:"run-goal"`, the "unattributable" floor value. The rail shows this as the row's actor.
5. **Side effect on retention.**
   - 54 of the newest 100 records are goal-less. They take more than half of the 100-record content window, so operator runs are compacted sooner.
   - The 490 refusals did no work, but each one still takes a slot.

---

## 4. Findings

1. **After a walk ends, no step's output content is addressable as an impulse anywhere.**
   - The only retained copies are previews (2,000 chars, last walk, newest 100 records) and, for the floor, `final_text` (4,000 chars).
   - web_search and llm_completion keep no store, the `impulse` table has no content column, and pool ids are neither durable nor unique.
   - This is why `bestOutput.ts` scrapes walk-log excerpts.
2. **The run is reconstructible from addressable stores only as structure**, by joining the trace on its `dispatch:<id>` tag (73,287/150,327 rows): activity, shapes, verdict, label and goal text where one exists. That is enough for a rail and a verdict. It is not enough for an answer.
3. **The one durable answer (`final_text`) is reachable only through a form nobody holds.** It needs the record-literal id and `format:"json"`, and the surface proxy cannot reach activity-api in any case.
4. **"Goal text not recorded" is mostly pinned dispatches**, plus a record schema that drops the fields that would describe them.
5. **The `answerBody` and `goalReachReason` that survive compaction are the only after-the-fact content on the record**, and `answerBody` exists only on reach (169/2,001).

---

## 5. Inside the surface grant (no coordinator dependency)

- **S1. Name goal-less rows.**
  - Seam: `RunRow.tsx:90` and `RunView.tsx:206`.
  - Change: when `goal` is null, render `pinned: <selectedTemplateId>` (already on `activeDispatches`) with the error or reason as the subtitle. Show "goal text not recorded" only when both `goal` and `selectedTemplateId` are null.
  - Gate: a test fixture taken from the live board.
    - Must-fail: today's build renders 35/50 rows as "not recorded".
    - Positive: ribosome rows render `pinned: ribosome-extract`.
  - Status: new and small.
- **S2. Optional filter: hide refused-pin rows.**
  - These are rows with `reached:false`, no `selectedTemplateId` and an error that starts with "refusing pinned target".
  - Status: a view choice only. Raise it with the user before adding it.

## 6. Asks to the coordinator (goal-host and activity-api are not in this session's grant)

Every ask that makes something "resolvable by shape from the surface" is **gated on REALIGNMENT §9.0**: a locality allowlist plus route auth. Delivery by origin stays **HELD** (§9.5 D).

- **A1. Record what a pinned dispatch was.**
  - Seam: goal-host `/run-goal` record literal, `index.ts:16374`.
  - Change: add `targetTemplateId`, `tags`, and a bounded `variables` digest (keys plus ≤200 chars per value). Add a `ribosome-vessel-dispatch` rule to the trigger classifier (`:16335-16371`).
  - Gate: on the next 50 `activeDispatches`, every row has `goal` or `targetTemplateId` (today 35/50 have neither).
  - Builder: (a). Status: new.
- **A2. Return executionIds in their addressable form, or make the resolver accept bare ids.**
  - Seam (preferred): activity-api `routes/impulses.ts:916-920`. Add `OR id = type::thing('execution', $bare)`, the same normalisation the legacy branch already does at `:967`.
  - Gate:
    - Positive: `activityExecutionTrace {executionId:"exec_6d5vikum"}` returns 200.
    - Must-fail: an unknown id still returns 404.
  - Also make markdown include `metadata.final_text`, or default the surface to json.
  - Status: a fix to an existing reader.
- **A3. Pool content as addressable impulses.**
  - Extends B §7 **B1**: ids unique per dispatch (e.g. `<dispatchId>:<shape>:<n>`), `producedBy` set to the real producer.
  - Plus: persist each pool impulse's content (bounded, with the cut stated per §9.2) to one store whose reader already exists. Candidates are an `impulse` row with a content field, or the `execution_trace_content` task row the satisfier already writes.
  - Gate:
    - Positive: a trace's `output_impulse_ids[0]` resolves to content.
    - Must-fail: today's 0 of `walk-*` ids resolve.
  - Builder: (a). Status: extends `ced125b`, B1 and the closed satisfier-ids gap. The persistence half is new.
  - Do not reuse `poolImpulse` (the standing pool): it is replace-on-write bookkeeping with an open shapeless-write gap.
- **A4. Keep earlier attempts.**
  - This is the open gap `goalwalkstate-discards-prior-walk-attempts-within-a-dispatch`, unchanged.
  - Plus: always build `answerBody`, labelled not-reached (5 P3).
  - Status: already filed.
- **A5. Retention by value, not by recency.**
  - `pruneStore` (`index.ts:17880`) spends the 100-record content window on goal-less refusals.
  - Change: exempt records whose `selectedTemplateId` is null and whose error is a pin refusal from the 100 count, or compact them immediately. Better, express the window as a policy shape (law 1; already listed in C-decision-caps).
  - Gate: operator runs stay uncompacted for ≥ 24 h at the current rate.
  - Status: the cap is inventoried. The value ordering is new.
- **A6. Let the surface reach activity-api read shapes.**
  - Either goal-host's `/resolve` forwards read shapes by discovery, or the surface proxy resolves by shape through discovery (`proxy.ts:671`).
  - Gated on §9.0 (locality plus auth) and §9.1 (typed lookup).
  - Builder: surface half (b), discovery half (a).
