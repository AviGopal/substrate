# Tasks

## SPEC (this file + proposal.md)
- [x] Cite `concept_vugylIHzIMvk` and `concept_TbN0eSf7U_hM` as primary anchors.
- [x] Cite adjacent concepts (`concept_AIh9mrDEZcmJ`, `concept_YdzaAAQGx4xC`, `concept_uTVZPoaxMmo2`, `concept_skw2SmuLHZlN`, `concept_X2xSovM76TpT`, `concept_7mzv7SQN_7JB`) found via concept_search.
- [x] State the math under substrate primitives — arm = (signature, template), parametric prior `f_α`/`f_β`, O(|C|/ε²) → O(d/ε²), HyperAgent `Õ(√T)`.
- [x] Document the existing substrate surface — `thompson_posterior` resolver at `impulses.ts:1319`, `variant_performance_metrics`, `context_thompson_scores` (migration 130), `execution` aggregate, `LocalEmbeddingService` in concept-db.
- [x] Three implementation options with tradeoffs; recommend Option A (ridge).
- [x] Acceptance criteria as substrate-internal observables (per-cell variance, MRR delta, cold-cell coverage, regret, no new shape).
- [x] Out-of-scope list anchored to the four primitives.

## DEV

### Schema (additive, no breaking change)
- [ ] New migration `repos/metabob-activity-api/sql/migrations/143-embedding-conditioned-prior-weights.surql`:
  - Define table `thompson_prior_weights` with fields `template_family_id: string`, `w_alpha: array<float>` (length 384), `w_beta: array<float>` (length 384), `b_alpha: float`, `b_beta: float`, `org_id: option<string>`, `account_id: option<string>`, `signature_version: int DEFAULT 1`, `updated_at: datetime`, `sample_count: int DEFAULT 0`.
  - Composite UNIQUE index on `(template_family_id, org_id, account_id, signature_version)` for the org/account/global scope tuple (partial-pooling lookup).
  - PERMISSIONS clause keyed on `$token.org_id` to match the multi-tenant pattern (concept `concept_4oxAaGcI49Q3`).
- [ ] Register migration in `repos/metabob-activity-api/scripts/init-database.ts` migration list.

### Prior service
- [ ] New file `repos/metabob-activity-api/src/services/embedding-prior.ts`:
  - `embeddingPriorService.lookupPrior(templateFamilyId, embedding, scope)` — single matrix-vector dot product, returns `{ alpha_prior, beta_prior }`. Softplus on raw output. Fallback to `(1, 1)` when no row exists.
  - `embeddingPriorService.updateOnTrace(templateFamilyId, embedding, success, scope)` — online ridge update with learning rate `η` (config-configurable, default `1e-3`) and L2 regularisation `λ` (default `1e-4`). Increments `sample_count`. Uses `INSERT ... ON DUPLICATE KEY UPDATE`-equivalent SurrealQL `UPSERT`.
  - Scope ordering: try account → org → global, first hit wins (partial pooling).
- [ ] Unit tests `embedding-prior.test.ts`: zero-weights → Beta(1, 1) recovery; sign of weight update on success vs failure; scope fallback order.

### Read-path wire-up
- [ ] Edit `repos/metabob-activity-api/src/routes/impulses.ts` (`thompson_posterior` case, ~L1319-1500):
  - After computing empirical α/β from the `execution` aggregate, fetch the embedding for the variant (via concept-db client or pre-cached on the template record) and call `embeddingPriorService.lookupPrior`.
  - Combine: `alpha_out = empirical_alpha + (alpha_prior - 1)`, `beta_out = empirical_beta + (beta_prior - 1)` — keeps the Beta-conjugate update intact; collapses to today's behaviour when `(alpha_prior, beta_prior) = (1, 1)`.
  - Emit a new optional response field `prior: { alpha, beta, source: "embedding" | "uniform" }` for observability. (Not a new shape — additive field on the existing payload.)
- [ ] Concept-db client: thin wrapper in `src/services/concept-db-client.ts` that GETs `/concepts/search?embeddings=1` for a template-family id; cache 5 min in Redis (key `embedding:family:<id>`). If concept-db is down, fall back to `(1, 1)`.

### Update-path wire-up
- [ ] Edit `repos/metabob-activity-api/src/routes/execution-traces.ts:2203` block (`computeThompsonSamplingUpdates` call site):
  - After the existing `variant_performance_metrics` update, look up the variant's template-family embedding and call `embeddingPriorService.updateOnTrace`.
  - Guard with feature flag `EMBEDDING_PRIOR_ENABLED` (env var, default `false` until VERIFY phase clears it).
- [ ] Integration test `execution-traces.embedding-prior.test.ts`: ingest 50 traces against a synthetic family, assert weights move in the correct direction; assert posterior variance at sample_count=0 for a neighboring family drops below 0.0833.

### Lint / shape-dispatch
- [ ] `cd repos/metabob-activity-api && bun run lint && bun test` — both green. Confirms `bun run lint`'s shape-dispatch check still passes (no new shape, no new case).

## DEPLOY

### Substrate-live (local container, per CLAUDE.md)
- [ ] Sync activity-api source into substrate-live (`make -C scripts/substrate substrate-restart-activity-api`).
- [ ] Run init-database job in-container to apply migration 143: `docker exec substrate-live bun /vessels/metabob-activity-api/scripts/init-database.ts`.
- [ ] Restart activity-api unit: `docker exec substrate-live systemctl restart activity-api.service`.
- [ ] Set `EMBEDDING_PRIOR_ENABLED=false` initially in substrate env; confirm system runs identically to pre-change (regression guard).
- [ ] Flip `EMBEDDING_PRIOR_ENABLED=true`; restart activity-api once more.

### Seeding
- [ ] No template re-seed required (additive change).
- [ ] Capture pre-flip baseline embedding-prior table contents (should be empty).

## VERIFY

### Baselines (capture before flip)
- [ ] Run `validation/scripts/stratified-harness.ts` on substrate-live; record MRR, `improvise_health.success_rate`, per-cell variance histogram. Store under `openspec/changes/2026-06-04-learning-rate-1-embedding-conditioned-posterior/findings/baseline-<date>.json`.
- [ ] Run `validation/scripts/failure-mode-harness.ts`; record cumulative regret series.

### Post-flip measurements
- [ ] Drive ≥ 200 traces through substrate-live by running boredom-vessel for ~1h. Snapshot `thompson_prior_weights` table; confirm `sample_count > 0` for at least 5 families.
- [ ] Re-run stratified-harness; capture MRR. Acceptance criterion 2: MRR ≥ 0.26 (≥ +0.02 absolute over 0.2361 baseline).
- [ ] Recompute per-cell variance histogram for cells with sample_count ∈ [0, 5]. Acceptance criterion 1: median variance at sample_count=0 ≥ 30% below 0.0833.
- [ ] Compute cold-cell coverage = fraction of `(s, t)` cells with `α + β > 2.0001` after prior is applied. Acceptance criterion 3: ≥ 80%.
- [ ] Re-run failure-mode-harness over three windows; paired-test cumulative-regret slope vs. baseline. Acceptance criterion 4: p < 0.05.
- [ ] Confirm `bun run lint` still passes — shape-dispatch unchanged. Acceptance criterion 5.

### Concept-db percolation
- [ ] Emit a `concept_create_write` impulse with shape `impulse_activity_pattern` documenting the live result, linked `related_to` `concept_vugylIHzIMvk` and `concept_TbN0eSf7U_hM`. Trace id + concept id recorded in `findings/percolation-<date>.md`.

### Rollback path (rehearsed, not executed unless needed)
- [ ] Document: setting `EMBEDDING_PRIOR_ENABLED=false` reverts read+update behaviour to today's Beta(1, 1) prior with no schema migration required. The new `thompson_prior_weights` rows are inert; no other table reads them.
