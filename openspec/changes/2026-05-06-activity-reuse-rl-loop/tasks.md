# Tasks: Closing the Activity-Reuse RL Loop

**Change ID**: `2026-05-06-activity-reuse-rl-loop`

## 0. Pre-baseline (capture state before any change)

- [ ] 0.1 Snapshot Thompson posteriors for top-50 templates (by `total_executions`) into `validation/baselines/2026-05-06-thompson.json`. Include `alpha`, `beta`, `total_executions`, `success_rate`. Source: `GET /v2/activities/templates?limit=50&sort=total_executions:desc`.
- [ ] 0.2 Snapshot template count by `learning_track`: count of `unclassified` / `learning` / `system`. Document in baselines file.
- [ ] 0.3 Capture current 7-day reuse rate: count distinct `activity_id` in `trace_digest` over the last 7 days; compute `reused_executions / total_executions` where reused = activity_id created >24h before execution and ≠ `improvise`.
- [ ] 0.4 Run benchmark suite (once defined in §4) and store result as `validation/baselines/2026-05-06-mrr.json`.

## 1. Tags FTS index (capability: tags-fts-index)

- [ ] 1.1 Migration `repos/metabob-activity-api/sql/migrations/126-activity-tags-fts.surql`: `DEFINE INDEX OVERWRITE idx_activity_tags_fts ON activity FIELDS tags FULLTEXT ANALYZER activity_analyzer BM25(1.2, 0.75) HIGHLIGHTS;` followed by `REBUILD INDEX idx_activity_tags_fts ON activity;`. Idempotent across reruns.
- [ ] 1.2 Update canonical schema `repos/metabob-activity-api/sql/schemas/040-fts-recommendation.surql` to include the tags index alongside the existing two.
- [ ] 1.3 Extend `queryActivitiesByFTS` in `repos/metabob-activity-api/src/db/paradigm.ts`: add `tags @2@ '<lit>'` to the WHERE clause and `+ search::score(2) * 1.5` to the ranking expression. Weight: name=2, tags=1.5, description=1 (tags more specific than description, less canonical than name).
- [ ] 1.4 Integration test: insert a template with `tags: ["bugfix.auth.tokens"]`, query `q=auth`, assert it appears in top-3 with non-zero `fts_score`.
- [ ] 1.5 Integration test: query with hierarchical search `q=bugfix.auth`, assert templates with `bugfix.auth.*` tags rank above templates with only `bugfix.*` tags.
- [ ] 1.6 Deploy migration via canary then production. Verify `INFO FOR INDEX idx_activity_tags_fts ON activity` returns expected metadata.

## 2. Failure-mode-stratified updates (capability: failure-mode-stratified-updates)

- [ ] 2.1 Create `repos/metabob-activity-api/src/lib/posterior-update.ts` exporting `applyOutcomeToPosteriors(trace: ExecutionTrace): Promise<UpdateSummary>`. Single entry point invoked by the existing trace-write path.
- [ ] 2.2 Implement update rules per design §4.2(a):
  - `success` (no failure_mode): α += 1
  - `failure_mode.type === 'verifier_negative'`: β += 1; also write `impulse_relevance_metrics` row with `times_failed += 1` for each `input_impulse_id`
  - `failure_mode.type === 'budget_exhausted'`: β += 0.5; update `cost_per_success` running average
  - `failure_mode.type === 'safety_breach'`: β += 1; mark composition edge `safety_failed = true`
  - `failure_mode.type === 'cascading'`: β += 0 on this activity; full β += 1 on `failure_mode.context.upstream_task_id`'s ancestor (covered by §3 propagation)
  - `failure_mode.type === 'user_abort'`: no posterior change
  - `failure_mode === null`: default to `verifier_negative` semantics; emit `logger.warn('[posterior] failure_mode null; defaulting to verifier_negative')` with execution_id
- [ ] 2.3 Replace existing fetch-modify-write at `execution-traces.ts:1938`, `activities.ts:3599`, `activities.ts:3639`, `goal-paths.ts:402` with calls to `applyOutcomeToPosteriors`. Use atomic `+=` per `surrealdb-rl-layer` P1 (or interim non-atomic update if P1 not yet shipped — flag this risk in commit).
- [ ] 2.4 Unit tests for each branch in `applyOutcomeToPosteriors`: seed a posterior, apply each failure_mode type, assert exact α/β deltas.
- [ ] 2.5 Integration test: trigger a `verifier_negative` execution end-to-end, assert `impulse_relevance_metrics` for input shapes show `times_failed += 1`.
- [ ] 2.6 Add metric `posterior_update.failure_mode_distribution` to startup logs every 10 minutes — count of each failure_mode.type seen, including the `null → verifier_negative` default. Surface in workbench observability tab.

## 3. Composition-chain credit propagation (capability: composition-chain-credit-propagation)

- [ ] 3.1 Add `propagateCreditAlongChain(execution: Execution, outcome: Outcome): Promise<PropagationSummary>` to `repos/metabob-activity-api/src/lib/posterior-update.ts`. Reads `composition_chain` from the execution record (post-storage so chain is denormalized).
- [ ] 3.2 Iterate `composition_chain` from leaf to root; cap depth at 4 (configurable via `CREDIT_PROPAGATION_MAX_DEPTH`); decay factor `γ = 0.5` (configurable via `CREDIT_PROPAGATION_GAMMA`).
  - Direct parent (depth 1): α/β += `γ^1 = 0.5`
  - Grandparent (depth 2): α/β += `γ^2 = 0.25`
  - Great-grandparent (depth 3): α/β += `γ^3 = 0.125`
  - Depth 4: α/β += `γ^4 = 0.0625`
- [ ] 3.3 `cascading` failure: skip propagation to ancestors descended from `failure_mode.context.upstream_task_id` (don't double-penalize the upstream cause).
- [ ] 3.4 Use the same atomic `+=` operator as Task 2.3.
- [ ] 3.5 Unit test: seed a 4-deep chain `A→B→C→D`, succeed on D, assert A.α += 0.0625, B.α += 0.125, C.α += 0.25, D.α += 1.0 (D is direct, gets full success per §2.2).
- [ ] 3.6 Unit test: same chain, fail with `cascading` from B, assert A receives no propagation (descended from upstream cause), C/D receive no propagation (failure originated upstream).
- [ ] 3.7 Integration test: execute the dispatch-chain `goal-processing-activity-driven → activity-recommendation → improvise`, assert improvise's success bumps `goal-processing-activity-driven.α` by 0.25 (depth 2).

## 4. Activity-reuse validation harness (capability: activity-reuse-validation-harness)

- [ ] 4.1 Create `validation/activity-reuse-benchmark.json` with 20 `(goal_text, expected_activity_id, expected_output_shapes)` tuples. Mix: 8 bug-fix goals, 6 feature-add goals, 4 refactor goals, 2 documentation goals. Curate from existing successful traces; document selection criteria.
- [ ] 4.2 Create `validation/scripts/reuse-harness.ts` (Bun script). For each benchmark entry:
  1. Call `POST /v2/activities/recommend` with goal_text and impulse_state_space derived from a fixed seed pool
  2. Record rank position of `expected_activity_id` in the response
  3. Compute MRR across the full set
- [ ] 4.3 Extend the harness to record Thompson posterior snapshot for top-50 templates: `(activity_id, alpha, beta, total_executions, success_rate, ci_width)` where `ci_width` = Beta(α, β) 95% CI upper - lower.
- [ ] 4.4 Extend the harness to compute 7-day reuse rate (per design §5.1) via SurrealDB query: `SELECT activity_id, count() FROM trace_digest WHERE executed_at > time::now() - 7d GROUP BY activity_id;` join against `activity_template.created_at` to filter to templates created >24h before execution.
- [ ] 4.5 Emit results to `validation/results/{ISO_DATE}-reuse-report.json` with schema: `{ baseline_ref, mrr, reuse_rate, improvise_share, top_template_ci_widths, deltas_vs_baseline }`.
- [ ] 4.6 Add a `validation/scripts/compare-reports.ts` that diffs two reports and prints a markdown table of changes.
- [ ] 4.7 Document run procedure in `validation/README.md` — single command `bun run validation/scripts/reuse-harness.ts --baseline 2026-05-06`.
- [ ] 4.8 Schedule weekly run via existing scheduler or CI workflow (out-of-band; not blocking this change).

## 5. Validation campaign

- [ ] 5.1 Capture pre-tags-FTS baseline (Tasks 0.1–0.4 complete).
- [ ] 5.2 Deploy tags FTS (Task 1.6). Re-run harness 24h after deploy. Confirm MRR delta ≥ +0.05.
- [ ] 5.3 Deploy failure-mode-stratified updates (Task 2 complete). Re-run harness 1 week later. Confirm posterior CI widths narrowed for top-10 templates.
- [ ] 5.4 Deploy credit propagation (Task 3 complete). Re-run harness 1 week later. Confirm parent activities of frequently-composed leaves now appear in top-20 by α (where they previously sat below).
- [ ] 5.5 Composite report: 4-week trajectory of MRR, reuse rate, improvise-share, top-10 CI width. Land as `docs/learning-loop-2026-05-validation.md`.

## 6. Documentation

- [ ] 6.1 Update root `CLAUDE.md` "Recent stabilisation" section with a one-line summary of the four changes once shipped.
- [ ] 6.2 Update `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` with the RL-GNN framing from design §1 (one paragraph + the table).
- [ ] 6.3 Add a "Validation" section to root `CLAUDE.md` pointing at the harness and explaining the weekly cadence.
