# Tasks — Learning-Rate Mechanism 3: Background Trace Replay

Estimated effort: **1-2 weeks for one implementing agent**. Sequenced for
mostly-linear execution; §SPEC and §DEV.1 can run in parallel with §DEV.0.

## SPEC

- [ ] **S.1** Author `specs/background-trace-replay/spec.md` mirroring the
  proposal's mechanism section. Define the exact JSON wire formats:
  - Request body for new endpoint `GET /v2/activities/execution-traces?input_shapes_contains=…`
  - Counterfactual-judgement LLM prompt template (versioned;
    `replay_prompt_v1`).
  - `impulseRelevance_write` extension: required new fields `source`,
    `replay_trace_id`, `replay_weight`.
  - `template_created` WS event payload schema.
- [ ] **S.2** Author `specs/background-trace-replay/observables.md` —
  formal Prometheus metric names + label schemas for replay-success-rate,
  replay-coverage, replay-cost, incumbent-impact, judge-calibration.
  Cross-reference `docs/architecture/LITERATURE_COMPARISON.md:367` §9.3.
- [ ] **S.3** Update `concept_YinkepAheImS` summary (concept-db write) with
  pointer to this change once shipped. Add new concept
  `replay_weight_schedule` as a child of `concept_YinkepAheImS`, body =
  rationale for 0.3 default + adaptive future.
- [ ] **S.4** Three-place-rule audit: every new shape (`replay_judgement`,
  `replay_no_matches`, `template_created` if treated as shape rather than
  WS-only) is added to (a) the producing vessel's discovery
  advertisement, (b) `repos/metabob-activity-api/src/config.ts`
  shape catalogue, and (c) any case statement in `impulses.ts` that needs
  to recognise it. Document the audit in `findings/three-place-audit.md`.

## DEV

### DEV.0 — Prerequisite: template_created WS event

- [ ] **0.1** In `repos/metabob-activity-api/src/routes/activities.ts:903`
  (`POST /templates`) emit a `template_created` event through
  `broadcaster.emit(...)` (`repos/metabob-activity-api/src/websocket/broadcaster.ts:239`)
  on successful UPSERT. Payload matches the form documented in
  `repos/metabob-activity-api/docs/API_REFERENCE.md:2093`, augmented with
  `input_shapes: string[]` and `output_shapes: string[]` extracted from
  the persisted template body.
- [ ] **0.2** Same for `activityTemplate_write` impulse path
  (`repos/metabob-activity-api/src/routes/impulses.ts:2395-2401`) — both
  paths must emit identically. Factor a single
  `emitTemplateCreated(template, mode: 'rest' | 'impulse')` helper.
- [ ] **0.3** Distinguish *creation* from *update*. Read pre-UPSERT row
  state inside the transaction (or use `count` of affected rows) — emit
  `template_created` on insert and `template_updated` on update with diff
  metadata `{ changed_fields: string[] }`.
- [ ] **0.4** Add tests in
  `repos/metabob-activity-api/src/routes/activities.test.ts` and
  `…/impulses.test.ts` asserting WS emission for both code paths.
  Reuse the in-process broadcaster test harness from
  `repos/metabob-activity-api/src/websocket/broadcaster.test.ts`.

### DEV.1 — Shape-matched trace query endpoint

- [ ] **1.1** Add `GET /v2/activities/execution-traces` query parameters
  `input_shapes_contains: string[]` (CSV) and `stratify_by: string`
  (default `context_bucket`) to the handler that owns trace listing
  (search around `repos/metabob-activity-api/src/routes/execution-traces.ts:2387-2391`).
  Reuse the existing `shapes: body.input_impulse_shapes` index path.
- [ ] **1.2** SurrealQL: `SELECT id, input_impulse_shapes,
  output_impulse_shapes, success, context_bucket, started_at FROM
  activity_execution_traces WHERE $shapes ALLINSIDE input_impulse_shapes
  ORDER BY started_at DESC LIMIT 50` with per-`context_bucket` stratified
  cap of `ceil(limit / num_buckets)`. Add a SurrealDB index on
  `input_impulse_shapes` if not present — confirm by reading
  `repos/metabob-activity-api/sql/schemas/` and noting in
  `findings/index-audit.md`.
- [ ] **1.3** Tests in
  `repos/metabob-activity-api/src/routes/execution-traces.test.ts`:
  empty result, exact-match, superset-match, stratified-cap, perms isolation
  (org A cannot see org B traces).
- [ ] **1.4** Advertise the endpoint shape `executionTraceListByShapes` in
  `repos/metabob-activity-api/src/config.ts` near the existing
  `executionTraceList` entry (`config.ts:262-266`).

### DEV.2 — `impulseRelevance_write` weighted-source extension

- [ ] **2.1** Extend the request schema for `POST /v2/activities/impulse-relevance`
  (`repos/metabob-activity-api/src/routes/activities.ts` — find via the
  `/impulse-relevance` route binding) to accept optional fields `source`
  (enum `live` | `background_replay`), `replay_trace_id: string`,
  `replay_weight: number` (0..1, default 1.0).
- [ ] **2.2** Thread these into the SurrealDB UPDATE/CREATE on
  `impulse_relevance_metrics` so the persisted row records provenance.
  Add a migration in `repos/metabob-activity-api/sql/migrations/` adding
  the three columns (nullable, default values match `live`).
- [ ] **2.3** Same field surface on `impulseRelevance_write` impulse
  resolver (`repos/metabob-activity-api/src/routes/impulses.ts:2421`).
- [ ] **2.4** Aggregate read path: include `posterior_replay_fraction =
  sum(replay_weight) / total_weight` in the recommendation response
  (`/v2/activities/recommend`). Consumers can opt to discount.
- [ ] **2.5** Tests covering: weighted-α only, weighted-β only,
  live + replay mixed, replay-fraction read-back.

### DEV.3 — Replay observer in ribosome-vessel

- [ ] **3.1** New module `repos/ribosome-vessel/src/replay-observer.ts`:
  `class TemplateReplayObserver` with `enqueue(event)`, bounded queue
  (max 100, drop-oldest), bounded concurrency (default 2). Subscribes to
  the WS dispatch loop at `repos/ribosome-vessel/src/index.ts:173`-area
  by adding a new case `template_created`.
- [ ] **3.2** `findShapeMatchedTraces(template, cap=50)` calls the new
  endpoint from DEV.1. Stratified by `context_bucket`.
- [ ] **3.3** `hydrateTrace(traceId)` resolves
  `executionTraceWithSignatures` via `POST /v2/impulses/resolve` at
  `repos/metabob-activity-api/src/routes/impulses.ts:3009`.
- [ ] **3.4** `buildJudgementPrompt(template, hydratedTrace)` produces
  the `replay_prompt_v1` string defined in S.1. Includes the new
  template's task graph + the recorded inputs matching its
  `input_shapes` + the recorded outcome shapes.
- [ ] **3.5** `callJudge(prompt)` POSTs to `llm-resolver-vessel`
  (`repos/llm-resolver-vessel/src/index.ts:307`) shape `llm_completion`.
  Parses `{score, confidence, divergent_task?}` from a JSON envelope.
  Schema-validate; on parse failure log + skip the sample (do not write).
- [ ] **3.6** `writeReplayUpdate({templateId, traceId, score,
  confidence})` POSTs `impulseRelevance_write` with
  `alpha_delta = score * 0.3 * confidence`,
  `beta_delta = (1-score) * 0.3 * confidence`,
  `source: 'background_replay'`, `replay_trace_id: traceId`,
  `replay_weight: 0.3`.
- [ ] **3.7** Per-template **abort-on-imbalance guard**: if
  Σ β-delta-to-incumbents > 3 × Σ α-delta-to-new-template within one
  replay run, abort the rest of the run and emit a
  `replay_aborted_imbalance` event. Tracks the §math invariant.
- [ ] **3.8** Health endpoint in `repos/ribosome-vessel/src/index.ts`
  `/health` JSON includes `replay_queue_depth`, `replay_concurrency`,
  `replay_last_completed_at`, `replay_total_24h`,
  `replay_aborted_imbalance_24h`.

### DEV.4 — Cost ceiling & rate limiting

- [ ] **4.1** Env var `REPLAY_MAX_CALLS_PER_WEEK` (default 1000) read at
  ribosome-vessel boot. Token-bucket refilled at start of week (UTC).
- [ ] **4.2** When bucket empty, queue items are dropped with
  `replay_skipped_budget` event (counted; not lost — visible in metrics).
- [ ] **4.3** Per-template cap `REPLAY_MAX_PER_TEMPLATE` (default 50)
  enforced before enqueue.

### DEV.5 — Observability

- [ ] **5.1** Prometheus metrics in ribosome-vessel:
  `substrate_replay_runs_total{outcome,template_id}`,
  `substrate_replay_judge_score_bucket`,
  `substrate_replay_queue_depth`,
  `substrate_replay_llm_cost_usd_total`.
- [ ] **5.2** Logs: structured (vessel_id, template_id, trace_id, score,
  confidence, weight, source).
- [ ] **5.3** Add a substrate concept `replay_run_summary` (shape) that
  gets written via concept-db at the end of each batch of replays for a
  template — enables substrate self-inspection via `concept_search`.

### DEV.6 — Calibration hook (oracle agreement)

- [ ] **6.1** Read path: for templates that have replay rows and ≥10 live
  dispatches, compute live-only posterior vs. replay+live posterior,
  surface delta in `/v2/activities/variant-metrics-summary` response
  under field `replay_calibration_delta`.
- [ ] **6.2** Substrate-side audit activity (development-vessel seed
  template): `replay-calibration-audit` reads the delta across all
  replay-touched templates and emits a `substrateGap` if mean |delta| >
  0.2 for any template family. Spec only — implementation deferred.

## DEPLOY

- [ ] **D.1** Local substrate validation (Phase 26 single-container):
  `make -C scripts/substrate substrate-restart-ribosome-vessel` and
  `…-restart-metabob-activity-api`. Verify boot, WS connect,
  `/health` payload includes new replay fields, and one synthetic
  `template_created` triggers one replay (use seeded historical traces).
- [ ] **D.2** Substrate harness:
  `bun run validation/scripts/failure-mode-harness.ts` includes a
  `replay_no_matches_on_novel_shape` scenario — author a template whose
  `input_shapes` are guaranteed not to match any historical trace, assert
  `replay_no_matches` event fires and no LLM call is made.
- [ ] **D.3** Add `replay_weight_distribution` panel to dashboard
  (`repos/activity-dashboard/`) reading the new aggregate fields. Spec
  only — design.md describes the panel; implementation handled by a
  separate frontend change.
- [ ] **D.4** CI: ensure new tests in `metabob-activity-api` and
  `ribosome-vessel` are wired into each repo's `bun test`. No new test
  infrastructure required.
- [ ] **D.5** Helm: add ribosome-vessel env vars
  `REPLAY_MAX_CALLS_PER_WEEK`, `REPLAY_MAX_PER_TEMPLATE`,
  `REPLAY_CONCURRENCY` (defaults preserved). Update
  `repos/deployment/charts/ribosome-vessel/values.yaml` and
  `repos/deployment/environments/local.values.yaml` /
  `canary.overrides.yaml`.
- [ ] **D.6** Promote to canary (`/deploy` skill is suspended per
  project memory `project_deployment_direction_2026_05_23`; flag for
  operator). Until then, local-substrate validation is the deploy
  surface.

## VERIFY

- [ ] **V.1** **Coverage gate.** Within 1h of canary deployment, author 3
  test templates with varying `input_shapes` overlap with the historical
  corpus. Assert each receives at least one replay attempt within 60s
  of `template_created`. Capture in `findings/verify-coverage.md`.
- [ ] **V.2** **Cold-start lift gate.** For a test template with ≥10
  shape-matched historical traces, assert posterior α+β ≥ 3.0
  (weighted) within 5 minutes of authoring — vs. baseline 1.0 from
  Beta(1,1). Query via `GET /v2/activities/variant-metrics-summary`.
- [ ] **V.3** **No-regression gate.** Run for 1 week on canary. Assert
  aggregate β-delta to incumbents from `source=background_replay` is <
  10% of β-delta from `source=live`. Query the
  `impulse_relevance_metrics` table directly. Capture in
  `findings/verify-no-regression.md`.
- [ ] **V.4** **Calibration gate.** After 2 weeks of live data on
  replay-seeded templates, compute mean |live-only-posterior −
  replay+live-posterior| over all templates with ≥10 live dispatches and
  ≥10 replay rows. Target < 0.2. If above, write a follow-up change to
  reduce default `replay_weight` from 0.3.
- [ ] **V.5** **Push-away correlate (long horizon).** Track
  replay-success-rate weekly across all new templates; record window in
  `findings/push-away-correlate.md`. Per
  `LITERATURE_COMPARISON.md:367` §9.3, this is the early observable for
  IAL S2→S3 push-away — full correlation analysis is its own future
  change once enough windows accumulate (≥4).
- [ ] **V.6** **Cost gate.** After 1 week, assert weekly LLM spend
  attributable to replay (filter by `substrate_replay_llm_cost_usd_total`)
  is < 5% of total substrate LLM spend. Adjust
  `REPLAY_MAX_CALLS_PER_WEEK` if exceeded.
- [ ] **V.7** **Substrate-citizen check.** Confirm via `concept_search`
  that `replay_run_summary` concepts are accumulating in concept-db, so
  the substrate can introspect its own replay behaviour as data, not
  opaque counter.
