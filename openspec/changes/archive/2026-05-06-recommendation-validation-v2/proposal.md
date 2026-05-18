# Proposal: Recommendation Validation v2

## Problem

The Phase 18 harness (`validation/scripts/reuse-harness.ts`) cannot distinguish retrieval failures from
Thompson-ranking failures. Its benchmark (`activity-reuse-benchmark.json`) contains 20 entries all using
the `activity:⟨WrappedName⟩` double-prefix form — these exist in the registry but have low Thompson scores
and rarely surface in `POST /v2/activities/recommend` results. The result is a combined metric that is
noisy, hard to interpret, and not actionable.

Specific failures observed in the post-G5-backfill run (MRR=0.1542, Hit@1=10%):

1. **Benchmark uses wrong ID namespace.** All 20 `expected_activity_id` values are wrapped-form IDs
   (e.g. `activity:⟨Activity System Verification Test Suite⟩`). The Thompson recommend pool draws from
   templates with meaningful execution histories; most wrapped-form templates have `total_executions=0`
   and do not appear in the pool regardless of FTS retrieval quality.

2. **Single endpoint tested, two concerns conflated.** `POST /v2/activities/recommend` combines FTS
   retrieval, dense retrieval, and Thompson sampling into one ranked list. Improving the FTS index
   (Phase 18.1) produced a real signal improvement that was masked by Thompson-tier ranking of the
   expected templates. The harness cannot attribute whether a miss is a retrieval miss or a ranking miss.

3. **No integration test for composition-chain credit propagation (18.4.7).** The propagation logic
   (`propagateCreditAlongChain`, γ=0.5, depth 4) shipped in 18.4 but there is no test that confirms a
   child execution's success actually increments an ancestor's α.

4. **No automated weekly CI run (18.2.9).** Harness runs are manual; regressions are only caught when a
   developer happens to re-run it.

5. **No behavioral validation.** The harness measures whether the right template *appears* in results but
   not whether it *executes correctly* (shape contract, resolver availability, task success). Improvise
   health, resolver tool adequacy, and reuse trajectory are currently invisible. The existing
   `trace_stats` block counts improvise occurrences but does not measure whether those improvise
   executions succeed, whether the ribosome fires afterward, or whether the system is trending toward
   more deterministic resolver use over time.

## What Changes

### V2.0 — Benchmark curated from the Thompson pool

`validation/activity-reuse-benchmark-v2.json` — 20 entries drawn from templates that are **confirmed to
appear in the recommend pool** (i.e., from the Thompson snapshot top-50 with non-trivial execution counts
or semantic role, excluding double-prefix wrapped rows). Each entry adds three fields absent from v1:
`expected_activity_name`, `search_query` (short FTS-targeted term), and `tags` (what the search_query
should exercise).

### V2.1 — Two-metric harness extension

`reuse-harness.ts` extended to emit two separate rank-lists per entry:

- **search_mrr**: from `GET /v2/activities/templates?q={search_query}&limit=20` — FTS-only, no Thompson
- **recommend_mrr**: from `POST /v2/activities/recommend` with `task_description=goal_text` — existing

This produces a 2×2 diagnostic: (found in search / not found in search) × (found in recommend / not found
in recommend) which directly attributes each failure to retrieval or ranking.

### V2.2 — Composition-chain credit integration test (18.4.7)

`validation/scripts/test-18-4-7-credit-propagation.ts` — submits a synthetic trace with a known
`composition_chain`, waits for async posterior update, and asserts the ancestor's α incremented by at
least `floor(γ^depth * 1000) / 1000`.

### V2.3 — Weekly CI integration (18.2.9)

`validation/scripts/run-weekly-harness.sh` + `.github/workflows/weekly-recommendation-validation.yml`.
Runs Monday 09:00 UTC against canary. Exits non-zero and blocks on >10% MRR regression vs prior run.

### V2.4 — Behavioral validation section in harness

Extends `reuse-harness.ts` to compute four behavioral metrics from recent execution traces and
recommendation responses: improvise health, recommendation executability, resolver coverage, and reuse
trajectory. These are reported alongside `search_mrr`/`recommend_mrr` in the weekly report and
included in the `compare-reports.ts` delta table so operators can observe trend direction over time.

The four metrics answer the questions that retrieval-only measurement cannot:
- Is improvise failing silently or recovering through ribosome extraction?
- Is the top recommendation actually runnable (shape contract, non-LLM tasks)?
- Is the LLM resolver being overused because registered resolvers aren't being surfaced?
- Is the system trending toward reuse (known templates) rather than improvisation?

## Success Criteria

- `recommend_mrr` ≥ 0.40 on the v2 benchmark within 4 weeks of deployment (vs 0.1542 on the old benchmark;
  the v2 benchmark is anchored to the actual pool so this is achievable)
- `search_mrr` ≥ 0.60 on the v2 benchmark within 4 weeks (FTS should rank canonical templates high given
  their names match the goal descriptions)
- 18.4.7 integration test exits 0 against canary
- Weekly CI workflow runs without manual intervention and emits a delta table on each run
- When `search_mrr` ≫ `recommend_mrr` for a given entry, the delta table flags it as "Thompson burial" so
  operators know to warm up the posterior rather than fix retrieval
- Improvise health score ≥ 0.70 (at least 70% of improvise traces are successful) across two consecutive
  harness runs within 8 weeks of Phase 18 deploy
- Resolver coverage: `llm_tier_rate` ≤ 0.60 (at most 60% of sampled tasks escalate to LLM resolver)
  and showing a declining trend in `compare-reports.ts` delta output
- Reuse trajectory: `reuse_rate` ≥ 0.65 (at least 65% of traced goals use a known registered template,
  not improvise) within 8 weeks of Phase 18 deploy; `improvise_share` ≤ 0.25 in the same window
