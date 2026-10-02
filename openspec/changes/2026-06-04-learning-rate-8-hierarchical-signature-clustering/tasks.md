# Tasks: Hierarchical Signature Clustering via Dense Embedding

## SPEC

- [ ] S1. Cross-link `proposal.md` from `concept_skw2SmuLHZlN`'s graph by minting a `derived_from` edge once SPEC lands (operator-emitted `concept_link`, not code change).
- [ ] S2. Update `docs/architecture/SUBSTRATE_AS_MDP.md` §4.2: append paragraph noting that the partial-pooling rule generalizes to **any** parent-kernel pair, citing this proposal as the similarity-axis instance. No new section.
- [ ] S3. Confirm with concept_7mzv7SQN_7JB-aware reviewer that the cluster_id is treated as a derived function of signature, not a new primitive. Reject any review comment that frames cluster_id as a "new tier".
- [ ] S4. Specify the on-disk schema for `signature_cluster_assignment` and `signature_embedding` in a migration design doc (no SQL yet) — include `cluster_id`, `signature`, `signature_version`, `embedded_at`, `embedding[384]`, `contaminated` boolean.

## DEV

### Activity-API: schema + storage

- [ ] D1.1. Migration `sql/migrations/NNN_signature_embedding.sql` — `DEFINE TABLE signature_embedding SCHEMAFULL`, fields `signature`, `signature_version`, `embedding array<float, 384>`, `embedded_at`. Mirror PERMISSIONS pattern from `migration 131` (account/org scoping).
- [ ] D1.2. Migration `sql/migrations/NNN_signature_cluster_assignment.sql` — `DEFINE TABLE signature_cluster_assignment SCHEMAFULL`, fields `signature`, `signature_version`, `cluster_id` string, `assigned_at`, `contaminated bool DEFAULT false`. Index on `(signature_version, signature)` and on `(signature_version, cluster_id)`.
- [ ] D1.3. Migration `sql/migrations/NNN_context_thompson_scores_cluster.sql` — `DEFINE FIELD OVERWRITE cluster_id ON context_thompson_scores TYPE option<string>`. Existing rows backfill to NONE (treated as leaf-only).
- [ ] D1.4. Migration `sql/migrations/NNN_context_thompson_scores_cluster_rows.sql` — no schema change; document that cluster-level rows are stored in the same table with `context_bucket = "cluster:" + cluster_id` convention. (Composite key approach — keeps the table flat, mirrors how scope='global' marker is used today.)
- [ ] D1.5. Update `repos/metabob-activity-api/src/models/schemas.ts` with `SignatureEmbeddingSchema` and `SignatureClusterAssignmentSchema` Zod definitions.
- [ ] D1.6. Update `init_migrations` tracking table — confirm `scripts/init-database.ts` picks up the new migrations on pod restart.

### Activity-API: embedding pipeline

- [ ] D2.1. New module `repos/metabob-activity-api/src/lib/signature-embedding.ts` — wraps an HTTP call to concept-db's MiniLM embedder. New env var `CONCEPT_DB_EMBED_ENDPOINT` (default `http://localhost:8260/v1/embed`, where applicable). Treat as advisory: 500ms timeout, fallback returns `null`.
- [ ] D2.2. Background job `repos/metabob-activity-api/src/jobs/signature-embed-backfill.ts` — iterate signatures appearing in `context_thompson_scores` that don't yet have a `signature_embedding` row, embed in batches of 50, INSERT. Idempotent.
- [ ] D2.3. Hook into `posterior-update.ts:540` — when CREATEing a new `context_thompson_scores` row, fire-and-forget enqueue of `signature-embed-backfill` for that signature.

### Activity-API: clustering pass

- [ ] D3.1. New module `repos/metabob-activity-api/src/lib/signature-cluster.ts` — implements HDBSCAN over cosine distance on `signature_embedding` rows. Use `hdbscanjs` if available; otherwise a pure-TS port restricted to ≤50k rows.
- [ ] D3.2. Background timer `repos/metabob-activity-api/src/jobs/signature-cluster-tick.ts` — runs HDBSCAN every `SIGNATURE_CLUSTER_INTERVAL_MS` (default 6h). UPSERTs into `signature_cluster_assignment`. Records a `signature_cluster_run` log row (existing log-table pattern) with `n_signatures`, `n_clusters`, `n_noise`, `duration_ms`.
- [ ] D3.3. Contamination check inside the cluster tick: for each cluster, compute per-signature $\hat{p}_s$; flag `contaminated=true` when the spread exceeds 0.4 with $n_s \geq 5$.
- [ ] D3.4. Surface clustering status on `GET /v2/cluster/status` (new route) — returns last run timestamp, cluster count, noise count, contamination count. Mirror auth shape from `/v2/activities/templates`.

### Activity-API: cluster-level Thompson updates

- [ ] D4.1. Extend `posterior-update.ts:540–550` leaf write — after the leaf CREATE/UPDATE succeeds, look up `cluster_id` via `signature_cluster_assignment`. If found AND not `contaminated`, issue a second UPDATE-or-CREATE against `context_thompson_scores WHERE context_bucket = "cluster:" + cluster_id` with the same stratified `(α_delta, β_delta)`. Non-blocking on failure (log + continue).
- [ ] D4.2. Same wiring at `posterior-update.ts:311–316` chain-credit path.
- [ ] D4.3. Same wiring at `routes/execution-traces.ts:2463–2464` and `:2530–2531` legacy inline writes.
- [ ] D4.4. Add `clusterUpdate` metric counters via `src/lib/metrics.ts` — count cluster writes attempted / succeeded / skipped (signature missing) / skipped (contaminated).

### Activity-API: selector — partial-pooling read

- [ ] D5.1. Augment the resolver at `routes/impulses.ts:1395–1450` — after the org/account/global hop, add a cluster→signature hop **inside** the chosen scope. Pseudocode:
  ```
  rows = signatureQuery(scope)
  if n_signature >= N_MIN: use rows.alpha, rows.beta
  else: rows = clusterQuery(scope, cluster_id_of(signature)); use rows.alpha, rows.beta
  ```
- [ ] D5.2. New env var `SIGNATURE_CLUSTER_N_MIN` (default 5). Read at module init.
- [ ] D5.3. Emit `cluster_shadow_decision` impulse on every selector call: `{ signature, cluster_id, n_signature, used_scope: 'signature'|'cluster'|'fallback' }`. Use existing impulse write path; do not add a new resolver.
- [ ] D5.4. Expose `cluster_id` and `used_scope` on the response body of `context_thompson_scores` paginated read (`routes/impulses.ts:3460–3500`) so workbench can render which rows are leaf vs cluster.

### Activity-API: tests

- [ ] D6.1. `repos/metabob-activity-api/test/signature-cluster.test.ts` — unit: synthetic 100 embeddings in 3 Gaussian blobs, assert HDBSCAN finds 3 clusters and `<10%` noise.
- [ ] D6.2. `repos/metabob-activity-api/test/posterior-update-cluster-write.test.ts` — integration: after leaf update with a known `cluster_id`, the cluster row exists with matching α/β delta.
- [ ] D6.3. `repos/metabob-activity-api/test/posterior-update-cluster-fallback.test.ts` — integration: when signature has no cluster assignment (e.g., noise point), leaf write succeeds with no cluster row appearing.
- [ ] D6.4. `repos/metabob-activity-api/test/selector-cluster-shadow.test.ts` — integration: with $n_s < n_{\min}$, selector returns cluster posterior. With $n_s \geq n_{\min}$, selector returns leaf posterior.
- [ ] D6.5. `repos/metabob-activity-api/test/cluster-contamination.test.ts` — integration: synthetic cluster with $\hat{p}_s$ spread > 0.4 gets marked `contaminated`; selector ignores the cluster posterior for that cluster.

### Workbench (optional surface)

- [ ] D7.1. `repos/workbench/src/components/cluster/ClusterStatusPanel.tsx` — read `GET /v2/cluster/status`, render counts. Behind feature flag `VITE_ENABLE_CLUSTER_VIEW`.

## DEPLOY

- [ ] DEP1. Bump `repos/metabob-activity-api/package.json` minor version.
- [ ] DEP2. Add env vars to `repos/deployment/charts/activity-api/values.yaml`: `SIGNATURE_CLUSTER_INTERVAL_MS`, `SIGNATURE_CLUSTER_N_MIN`, `CONCEPT_DB_EMBED_ENDPOINT`.
- [ ] DEP3. Add the same env vars to `scripts/substrate/units/activity-api.service` and `scripts/substrate/gen-env.sh` for local single-container substrate.
- [ ] DEP4. Push to `dev`. CI/CD deploys to canary.
- [ ] DEP5. Verify migrations 130–134 (or whatever NNN we land on) applied — query `init_migrations` table.
- [ ] DEP6. Run `signature-embed-backfill` job manually first time — confirm `~3k` embeddings written.
- [ ] DEP7. Run `signature-cluster-tick` job manually first time — confirm cluster assignment table populated.

## VERIFY

- [ ] V1. Acceptance criterion 1 — query `context_thompson_scores`, compute cluster-vs-leaf row-count ratio per cluster with $K \geq 3$. Expect $\geq 0.7K$ ratio after 2 weeks.
- [ ] V2. Acceptance criterion 2 — replay-success on held-out signatures. Add a new `validation/scripts/cluster-shadow-replay.ts` script that takes a 10% signature hold-out, computes selector behavior with and without cluster shadowing, and reports delta. Threshold: delta ≥ -0.02.
- [ ] V3. Acceptance criterion 3 — `bun run validation/scripts/failure-mode-harness.ts` baseline shows zero new modes for 3 consecutive cycles.
- [ ] V4. Acceptance criterion 4 — `mcp__metabob__concept_search shape=hierarchical_signature_clustering_via_dense_embedding` shows relevance trending up. No new `*_tier` or `*_scope` concepts minted (audit via `concept_search shape="*tier*"` + `*scope*`).
- [ ] V5. Acceptance criterion 5 — `bun test repos/metabob-activity-api/test/posterior-update-cluster-fallback.test.ts` passes; integration trace shows leaf-only path when cluster lookup fails.
- [ ] V6. Self-detection check: file a `cluster_shadow_decision`-counter-stuck detector under `openspec/changes/2026-06-XX-detect-cluster-shadow-counter-stuck/` per `feedback_substrate_self_detection_recursive.md` — every new instrumentation surface needs its own staleness detector.
- [ ] V7. Substrate-citizen check: emit a `memoryNote_write` (or bridge-path file) summarizing the deployed mechanism and the n_min default — see `feedback_memory_as_substrate.md`.
