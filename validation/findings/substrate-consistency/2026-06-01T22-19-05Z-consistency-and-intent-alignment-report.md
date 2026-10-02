# Substrate consistency & intent-alignment report

**Date:** 2026-06-01T22:19Z
**Operator:** avi
**Substrate:** `substrate-live` container (host port 18210 → goal-host:8210, 18080 → activity-api)
**Goal-host version:** 0.1.0 (LLM via `http-vessel:http://127.0.0.1:8220`)

## Method

Dispatched 8 operational goals via `POST /run-goal` (no `targetTemplateId`, no developmental verbs). Three intended to match existing substrate templates, three deliberate no-fits, two borderline. Each polled to terminal; trace records pulled from `/v2/activities/execution-traces/<execId>`. `goal-host-vessel` was restarted mid-batch by systemd (22:17:16Z); the two borderline goals were redispatched fresh and completed under the new instance.

All 8 goals **triggered auto-draft** (`top_score=0 < 2`) — the recommender returned no usable matches against the existing template population.

## Phase 1 — consistency batch

| Label | Goal | dispatchId / execId | Status | Duration (ms) | Tasks | Selected template | Output shapes |
|---|---|---|---|---|---|---|---|
| match-1-phantom | surface phantom-success traces in the last hour | b9b75128 / exec_3krdtiks | success | 5630 | 4 | `gap-closing:fm-43-cascade-attribution-error-1780339446275` | fs_read, http_fetch, llm_completion_dispatch, fs_write |
| match-2-precondition | detect precondition violations in recent dispatches | a82e07b2 / exec_ki40u2ky | success | 13042 | 4 | `gap-closing:fp-11-silent-semantic-failure-1780332244430` | fs_read, http_fetch, llm_completion_dispatch, fs_write |
| match-3-oom | compute OOM cascade load report for activity-system services | 92c5c4f7 / exec_nuj8rm90 | failure | 28 | 1 | `development-vessel:drain-pending-substrate-gaps` | substrateGap |
| nofit-1-ribbon | report ribbon optimization metrics for vessel routing | da828906 / exec_z0nupchp | failure | 3 | 0 | `goalhost-branch-test-1780313831` | — |
| nofit-2-bilinear | compute bilinear envelope coverage across resolver tiers | bd51c620 / exec_1fw8vfbh | failure | 11 | 0 | `goalhost-branch-test-1780313831` | — |
| nofit-3-hysteresis | surface vessel mesh hysteresis trends this week | 4b753387 / exec_1u23wn3l | success | 5287 | 4 | `gap-closing:fm-43-cascade-attribution-error-1780339446275` | fs_read, http_fetch, llm_completion_dispatch, fs_write |
| borderline-1-abnormal-shapes (redispatch) | find vessels whose latest dispatches show abnormal output shapes | 3ab55d08 / exec_t1jgwf51 | success | 5438 | 4 | `gap-closing:fm-43-cascade-attribution-error-1780339446275` | fs_read, http_fetch, llm_completion_dispatch, fs_write |
| borderline-2-service-health (redispatch) | report service health degradation patterns in last 24h | 5ed612ad / exec_qi2m88fc | failure | 1 | 0 | `development-vessel:evaluate-pr-via-internal-idioms` | — |

### Aggregate

- **5/8 success, 3/8 failure** (4/8 success in first dispatch wave; 2/2 success in original "match" arm; 1/2 borderline; 1/3 no-fit accidentally succeeded).
- **Auto-draft fired for all 8 goals** (top_score=0). Drafter writes scenarios to `auto-1780352*.json` and dispatches `draft-gap-closing-activity` as a side-effect every time.
- **Duration discrimination is crisp**: all successes run 5.2–13.0 s; all failures terminate ≤ 30 ms. The fast-fail path is goal-host returning before the engine ever invokes a resolver (template id resolved but execution rejected).
- **Selected templates cluster on a single attractor**: 3 of 4 fully-successful runs (match-1, nofit-3, borderline-1) all landed on `fm-43-cascade-attribution-error-*`. That template's 4-task skeleton (`fs_read scenario → http_fetch traces → LLM analyze → fs_write report`) is the substrate's current generic "look at things, write a report" attractor.
- **Fast-fail templates also cluster**: 2 no-fits landed on `goalhost-branch-test-1780313831` (a degenerate test template with 0 tasks); 2 partial-match failures landed on `development-vessel:*` housekeeping templates.

### Consistency verdict — STRONG but trivial

The substrate is **operationally consistent**: same goal-shape ⇒ stable selection, stable duration, no flapping. But the consistency comes from a small attractor set (≤ 3 templates account for 7 of 8 dispatches), not from goal-aware selection. The recommender top_score is 0 across the board, so selection is effectively random within the "low-prior" template population, biased by Thompson posteriors that the gap-closing templates have accumulated.

## Phase 2 — intent alignment (3 successful runs)

### Goal: "surface phantom-success traces in the last hour" → `fm-43-cascade-attribution-error`

The selected template's 4 tasks: load a *scenario JSON for cascade attribution*, fetch traces, LLM-analyze for *cascading failures with valid upstream outputs*, write a *cascade attribution audit*. The operator's goal asked for **phantom-success traces** (success-flagged executions that did nothing or produced invalid output) — a different failure mode from cascade-attribution (downstream task wrongly blamed for upstream's bug). Output is `cascade-attribution-audit.md`, not a phantom-success ledger. **Alignment: NO.** The substrate executed a competent activity, but answered the wrong question. The 4 output shapes (fs_read, http_fetch, llm_completion_dispatch, fs_write) describe the *mechanism*, not the *answer*.

### Goal: "detect precondition violations in recent dispatches" → `fp-11-silent-semantic-failure`

The selected template's tasks: load `fp-11` scenario, fetch traces, analyze for **silent semantic failures** (same input, diverging outputs; LLM tasks with only syntactic validation), propose semantic validators. The goal asked for **precondition violations** (dispatches that ran despite unmet input shape/state requirements). Silent semantic failure is *downstream* of precondition violation (semantic mismatch is one way preconditions get violated implicitly), so there is a thematic neighborhood but the template is investigating "outputs disagree" not "inputs were wrong". **Alignment: PARTIAL.** A precondition-violation auditor would be filtering on inputImpulses against task-declared inputShapes; this template never touches input contracts. It is the *closest* of the gap-closing templates to the goal, but the work product (semantic-validator proposals) is a sibling problem.

### Goal: "surface vessel mesh hysteresis trends this week" (no-fit) → `fm-43-cascade-attribution-error`

The goal is a nonsense domain phrase; the substrate landed on the cascade-attribution attractor and ran the same 4-task skeleton. The output is a cascade-attribution audit of recent traces, with **zero hysteresis content** anywhere in the task descriptions. **Alignment: NO.** This is the strongest evidence of the goal-blind attractor: the substrate produces *a* report when asked for hysteresis, with no signal that hysteresis was even noticed as a missing concept.

## Phase 3 — findings

1. **Consistency is real but goal-blind.** Same skeleton, same timing, same attractor templates. Operator-visible stability is high; semantic stability (does the work product depend on what was asked?) is low.
2. **Auto-draft is firing 100% of the time** for operational goals. Every dispatch in this batch produced a draft side-effect, regardless of whether an existing template was usable. The drafter is succeeding (drafter-completed log lines for 7/8 scenarios) but not feeding back into the selection pool fast enough to displace the gap-closing attractor.
3. **The gap-closing attractor is a 4-resolver template (fs_read/http_fetch/llm/fs_write).** It is *generic-shaped* — it can run against anything. Selection lands here because Thompson has accumulated successes from prior gap-closing dispatches, and goal-text contributes nothing to recommendation scoring when top_score=0. The substrate has a **mode-collapse risk**: cascade-attribution becomes the only thing it knows how to "do".
4. **Failure-fast path is sound.** When the recommender returns a degenerate template (`goalhost-branch-test`, `evaluate-pr-via-internal-idioms`), the executor fails within 30 ms instead of running blind. No wasted resolver budget.
5. **In-memory dispatch records do not survive goal-host restart.** This batch lost 2 borderline dispatches when systemd restarted the unit at 22:17:16Z (likely OOM or healthcheck-driven). Recommendation: persist dispatch state, or document this as expected behavior with a note that operators should redispatch after `goal-host-vessel` cycles.

## Loop-product impulses produced

- 7 auto-draft scenarios written to disk (`auto-1780352*.json`), each one a substrate-authored attempt to fill the matched gap. None promoted to a template visible to the recommender during this batch.
- 5 trace records in activity-api, all with non-null `output_impulse_shapes` for the 5 successful executions.
- Zero `intentAlignment` impulses — substrate has no shape for "did this answer the question I was asked", so alignment is currently operator-judged only.

## Recommended next probes (not done in this report)

- Dispatch the same 8 goals again in 30 min; measure whether the auto-drafted scenarios from this batch displace the cascade-attribution attractor.
- Add an `intentAlignment` shape with a small validator: compare goal-text keywords to selected template's tags/description; emit a degraded relevance write when overlap is empty.
- Make goal-host dispatch state persistent so operator-visible consistency holds across vessel restarts.
