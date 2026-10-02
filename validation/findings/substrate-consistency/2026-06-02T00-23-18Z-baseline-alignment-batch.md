# Baseline Alignment Batch — Post-Recovery Independent Observation

**Timestamp:** 2026-06-02T00:23:18Z
**Branch:** dev (head e6d1712a before this commit)
**Substrate:** local single-container `substrate-live`
**Goal-host uptime at batch start:** ~40 s (just restarted at 00:16:24 UTC)
**Recovery state:** loose-reuse env-disabled (`SUBSTRATE_REUSE_KEYWORD_MIN=999`); goal-host promotes + uses freshly-authored templates per `7ae17e71`.

## Methodology

Sequential dispatch of 6 operational goals → `POST /run-goal` on `localhost:18210` → poll `GET /executions/:dispatchId` until terminal. Then SurrealDB query for each selected template's `name`/`description`/`proposed`, plus trace `duration_ms` + `output_impulse_shapes`.

## Results

| # | Goal | Template name | Duration (ms) | Tasks | Align |
|---|------|---------------|---------------|-------|-------|
| 1 | audit dispatches with anomalous duration | Audit Dispatches with Anomalous Duration | 8866 | 4 | YES |
| 2 | report Thompson alpha distribution per template | Report Thompson Alpha Distribution Per Template | 7246 | 4 | YES |
| 3 | surface stale promoted templates with zero usage | Surface stale promoted templates with zero usage | 8666 | 4 | YES |
| 4 | compute LLM cost per goal in the last hour | Compute LLM cost per goal in the last hour | 6437 | 4 | YES |
| 5 | detect vessel discovery heartbeat starvation | Detect Vessel Discovery Heartbeat Starvation | 11362 | 4 | YES |
| 6 | list activity templates without convergent-validity gates | List activity templates without convergent-validity gates | 11157 | 4 | YES |

**Aggregate:** YES=6 / PARTIAL=0 / NO=0 (6/6 aligned).

All templates were freshly authored (proposed=true, timestamps within seconds of dispatch). All carry domain-specific names that mirror the operator goal and descriptions that name the substrate gap being closed.

### output_impulse_shapes (uniform across all 6)

`["fs_read","http_fetch","llm_completion_dispatch","fs_write"]`

### task graph (uniform across all 6)

5 of 6 templates: `["read_scenario","fetch_traces","analyze","write_report"]`
1 of 6 (goal 6): `["task_read_scenario","task_fetch_traces","task_analyze","task_write_report"]`

The task graph is a standardized 4-step scaffold ("read scenario → fetch traces → analyze → write report"). Domain alignment lives in the name + description + LLM prompts inside the analyze step, NOT in the task graph itself.

## Note on Goal 2 Lost Dispatch

The first attempt at goal 2 (dispatch `e41b3f9f-…`) was lost when the goal-host-vessel restarted mid-flight (executionStore is in-memory; restart clears it). Polling returned `dispatch not found` 13× in a row. Re-dispatch succeeded on the second try. **Operational note:** the in-memory `executionStore` in `goal-host-vessel/src/index.ts:1057` is a known fragility; surviving a restart requires persisting it (or accepting that batches run during restarts will require re-dispatch).

## Phase 2 — Reuse Observation (near-paraphrase)

Dispatched goal: `"audit anomalous-duration dispatches"` (paraphrase of goal 1).

- Result: dispatch `3054576e-…`, execution `exec_wbip0buw`, template `gap-closing:auto-1780359763214-pts594-1780359769862` — a **brand-new authored template** (name "Audit anomalous-duration dispatches"), NOT goal 1's `auto-1780359253655`.
- Conclusion: **no reuse**. The selector + drafter currently authors a near-duplicate template for paraphrased goals rather than retrieving the existing one. This is the same pattern the previous batch flagged: intent alignment is YES per dispatch, but reuse-rate is ~0, meaning each operator question grows the template catalogue rather than exercising existing entries. The Thompson posterior cannot accumulate evidence on any single template if every new phrasing triggers a fresh author.

## Headline

Intent alignment recovered to a uniform 6/6 YES across operator-grounded goals. Names and descriptions are clearly domain-specific (no "Analyze gap" placeholder collapse). Authored templates are structurally identical (4-task scaffold + identical output_impulse_shapes), so divergence between templates is concentrated in their LLM prompt bodies. The dominant remaining drift is **no reuse on paraphrase** — every near-paraphrase mints a new template instead of selecting the previously-authored one. This is consistent with `SUBSTRATE_REUSE_KEYWORD_MIN=999` disabling the loose-reuse path and the LLM-based REUSE check returning `NONE` (visible in journald: "auto-draft REUSE (LLM): no candidate selected (raw=NONE)").

## Raw artifacts

| Goal | dispatchId | executionId | selectedTemplateId |
|------|-----------|-------------|--------------------|
| 1 | 0d25975b-97ad-47a4-b956-6ac47c2b8611 | exec_l098zjtr | gap-closing:auto-1780359253655-ag2rnv-1780359260854 |
| 2 | 12c08641-03f3-4ce2-9e48-a61ff58f2631 | exec_6jp91l6o | gap-closing:auto-1780359305432-mrx25g-1780359313393 |
| 3 | 8c0f5951-7d9e-46ae-8666-8900319de30a | exec_p2in27yh | gap-closing:auto-1780359473113-6ti2uh-1780359482594 |
| 4 | ea48a950-4c5c-4abb-b014-f1a3b2de8154 | exec_pmezdyio | gap-closing:auto-1780359509427-5gzsyh-1780359515784 |
| 5 | fc9b265b-d794-43c2-9fce-c9005f880067 | exec_wzlxx0ex | gap-closing:auto-1780359539812-guuvmg-1780359546471 |
| 6 | 652fb85f-7978-454f-93ba-315e41f9d434 | exec_uz1xk8vu | gap-closing:auto-1780359577748-ierwde-1780359584607 |
| Phase 2 | 3054576e-31b7-41a8-adaa-a65d3ff7eb7f | exec_wbip0buw | gap-closing:auto-1780359763214-pts594-1780359769862 |
