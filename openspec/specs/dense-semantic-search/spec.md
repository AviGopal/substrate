# dense-semantic-search Specification

## Purpose

BM25 full-text search — already deployed in both `metabob-activity-api` and `concept-db` — handles stemming and tokenization well but cannot bridge vocabulary gaps. A query of "fix login bug" will not surface a template whose name is "Resolve authentication error handling" because no stemmed token overlaps. Dense vector search closes this gap: both the query and each stored document are embedded into a 384-dimensional semantic space; proximity in that space captures meaning rather than token overlap.

This spec adds dense vector search to `metabob-activity-api` (activity templates) and `concept-db` (concepts), merges the two ranked lists via Reciprocal Rank Fusion (RRF), and routes the merged pool into the existing Thompson Sampling reranking step. The embedding model is `all-MiniLM-L6-v2` served via ONNX Runtime — 22 MB, CPU-only, no external service, ~5 ms per query. The design requires no new database index for typical fleet sizes; brute-force cosine scan over in-process float32 vectors is well under 50 ms for thousands of items.

---

## Requirements

### Requirement: ONNX embedding model loaded once at startup

Both `metabob-activity-api` and `concept-db` SHALL load the `all-MiniLM-L6-v2` ONNX model file and its tokeniser vocabulary at process startup, not per-request. The loading SHALL be asynchronous and non-blocking with respect to the HTTP listener — the server SHALL begin accepting requests before embedding is ready, but any endpoint that requires embeddings SHALL return a 503 with `{ "error": "embedding_model_not_ready" }` until the model has finished loading.

The model file (`model.onnx`) and vocabulary file (`vocab.txt`) SHALL be bundled into the Docker image under a path configurable via the `EMBEDDING_MODEL_DIR` environment variable (default: `/app/models/all-MiniLM-L6-v2`). The ONNX Runtime session SHALL be created with `executionProviders: ['cpu']` and `graphOptimizationLevel: 'all'`.

A single `EmbeddingService` singleton SHALL be exported from `src/services/embedding.ts` in each vessel. It SHALL expose:

- `isReady(): boolean` — returns true once the model is loaded
- `embed(text: string): Promise<Float32Array>` — tokenise, run inference, return the mean-pooled, L2-normalised 384-dim output vector
- `embedBatch(texts: string[]): Promise<Float32Array[]>` — batch variant for backfill

#### Scenario: server starts before model is ready

- **WHEN** the process starts and the ONNX model is still loading
- **THEN** `GET /health` returns `200` with `"embedding": { "status": "loading" }` in the checks object
- **AND** `POST /v2/activities/recommend` returns `200` with the existing BM25-only path (dense search is skipped, not errored, during model warm-up)

#### Scenario: model ready after warm-up

- **WHEN** `EmbeddingService.isReady()` becomes true
- **THEN** `GET /health` returns `200` with `"embedding": { "status": "healthy", "model": "all-MiniLM-L6-v2", "dim": 384 }`

#### Scenario: model file missing

- **WHEN** `EMBEDDING_MODEL_DIR` points to a directory that does not contain `model.onnx`
- **THEN** startup logs an error at level `error` and `EmbeddingService.isReady()` stays false permanently
- **AND** all search endpoints silently fall back to BM25-only without crashing

---

### Requirement: embedding fields on the activity table

The `activity` table in `metabob-activity-api` SHALL gain two new optional fields:

- `name_embedding`: `option<array<float>>` — 384-element L2-normalised vector of the activity's `name` field
- `description_embedding`: `option<array<float>>` — 384-element L2-normalised vector of the activity's `description` field (may be `NONE` when `description` is absent)

Both fields SHALL be added via a SurrealDB migration file at `sql/schemas/050-dense-embeddings.surql` using `DEFINE FIELD IF NOT EXISTS` statements on the `activity` table. No FULLTEXT or HNSW index is needed — cosine similarity is computed in-process.

#### Scenario: migration applied idempotently

- **WHEN** `050-dense-embeddings.surql` is applied on a database that already has the fields
- **THEN** the `IF NOT EXISTS` guard produces no error and the existing data is unchanged

#### Scenario: new template created without embedding yet

- **WHEN** an activity row is inserted before the backfill job has run
- **THEN** `name_embedding = NONE` and the dense search path treats a missing vector as a score of `0` rather than erroring

---

### Requirement: embedding fields on the concept table

The `concept` table in `concept-db` SHALL gain two new optional fields:

- `content_embedding`: `option<array<float>>` — 384-dim vector of the concept's `content` field
- `summary_embedding`: `option<array<float>>` — 384-dim vector of the concept's `summary` field

Both fields SHALL be added via a migration file under `sql/core/` (e.g., `004-dense-embeddings.surql`) using `DEFINE FIELD IF NOT EXISTS`. Computation and cosine scoring follow the same rules as for `activity`.

#### Scenario: concept with null content

- **WHEN** a concept has `content = NONE`
- **THEN** `content_embedding = NONE` and the dense search path skips the cosine term for that document without error

---

### Requirement: embeddings written at create and update time

In `metabob-activity-api`, when an activity template is **created** or **updated** via the API, the server SHALL asynchronously compute `name_embedding` and `description_embedding` via `EmbeddingService.embed()` and write them back to SurrealDB in a fire-and-forget `UPDATE` call. The primary write response to the caller SHALL NOT be delayed by embedding computation — the embedding write happens after the HTTP response is sent.

The same requirement applies to `concept-db`: `createConcept` and any update path SHALL trigger an async embedding write for `content_embedding` (using `content`) and `summary_embedding` (using `summary`). The async update SHALL be initiated with `Promise.resolve().then(async () => { ... }).catch(err => logger.warn(...))` so a failed embedding write never rejects the creating call.

#### Scenario: template created via API

- **WHEN** `POST /v2/activities/templates` succeeds for a new template with name "Deploy Helm chart"
- **THEN** within 500 ms the activity row has `name_embedding` set to a non-null 384-element float array
- **AND** the HTTP response to the caller was already sent before the embedding write completed

#### Scenario: template name updated

- **WHEN** `PATCH /v2/activities/templates/:id` changes the `name` field
- **THEN** a new `name_embedding` is computed and written asynchronously, overwriting the prior value

#### Scenario: EmbeddingService not ready at create time

- **WHEN** a template is created while the model is still loading
- **THEN** `name_embedding` remains `NONE` until the backfill job runs; no error is thrown to the caller

---

### Requirement: in-process cosine similarity search for activities

`metabob-activity-api` SHALL expose a new function `queryActivitiesByDense(searchQuery, orgId, executionType, limit, jwtToken)` in `src/db/paradigm.ts`. This function SHALL:

1. Call `EmbeddingService.embed(searchQuery)` to obtain a 384-dim query vector `q`.
2. Fetch all `activity` rows that match the org/scope/executionType filter and have a non-null `name_embedding` or `description_embedding`, selecting only `id`, `name`, `description`, `name_embedding`, `description_embedding`, and the standard template fields needed by downstream callers.
3. For each row, compute a scalar `dense_score` as:
   ```
   dense_score = max(
     cosine(q, name_embedding)        if name_embedding != null else 0,
     cosine(q, description_embedding) if description_embedding != null else 0
   )
   ```
   where `cosine(a, b) = dot(a, b)` (valid because both vectors are L2-normalised).
4. Sort descending by `dense_score` and return the top `limit` results as `ParadigmActivity & { dense_score: number }`.

The fetch in step 2 MAY use a single SurrealDB query that returns the embedding arrays as plain JSON arrays. Embedding arrays stored as `array<float>` in SurrealDB SHALL be cast to `Float32Array` before the dot product.

The cosine computation SHALL be a plain TypeScript loop (no BLAS dependency). For up to 10 000 documents this completes in under 50 ms on a single CPU core.

#### Scenario: semantic query finds vocabulary-gap match

- **WHEN** `queryActivitiesByDense('fix login bug', orgId)` is called
- **THEN** the result includes activities whose names contain "authentication" or "credential" even though neither word appears in the query, because the embedding space places them near "login bug"

#### Scenario: empty embedding set

- **WHEN** no activity row in the org has a non-null embedding
- **THEN** the function returns an empty array without error (BM25 path still runs)

#### Scenario: EmbeddingService not ready

- **WHEN** `EmbeddingService.isReady()` is false
- **THEN** the function returns an empty array immediately, logging at `debug` level

---

### Requirement: in-process cosine similarity search for concepts

`concept-db` SHALL expose a `searchConceptsByDense(query, orgId, filters, limit, jwtToken)` function in `src/resolvers/concept.ts` (or a new `src/resolvers/concept-dense.ts`). It SHALL follow the same pattern as `queryActivitiesByDense`:

1. Embed the query string.
2. Fetch concept rows matching org/scalar filters with non-null `content_embedding` or `summary_embedding`.
3. Score each row as `max(cosine(q, content_embedding), cosine(q, summary_embedding))`.
4. Return top `limit` rows sorted by `dense_score`.

---

### Requirement: RRF merge of BM25 and dense results

A pure function `mergeByRRF(bm25Results, denseResults, k = 60)` SHALL be implemented in both vessels (e.g., `src/utils/rrf.ts`). It SHALL:

1. Assign each document a BM25 rank `r_bm25` equal to its 1-based position in the BM25 result list (rank 1 = highest BM25 score). Documents absent from the BM25 list receive rank `∞` (treated as a very large integer such as `10000`).
2. Assign each document a dense rank `r_dense` analogously from the dense result list.
3. Compute `rrf_score = 1 / (k + r_bm25) + 1 / (k + r_dense)` for every document that appears in either list.
4. Return the merged list sorted by `rrf_score` descending.

The `k = 60` default SHALL NOT be a tunable parameter in the first implementation — it is omitted from the API surface to avoid premature configuration surface. The function SHALL be pure (no I/O) and unit-testable.

#### Scenario: document appears in both lists

- **WHEN** activity "A" is rank 1 in BM25 and rank 2 in dense
- **THEN** `rrf_score(A) = 1/(60+1) + 1/(60+2) = 0.01639 + 0.01613 = 0.03252`

#### Scenario: document appears in dense list only

- **WHEN** activity "B" is absent from BM25 results but is rank 1 in dense
- **THEN** `rrf_score(B) = 1/(60+10000) + 1/(60+1) = ~0.0001 + 0.01639`
- **AND** "B" still appears in the merged list (vocabulary-gap documents are surfaced, not dropped)

#### Scenario: both lists empty

- **WHEN** both BM25 and dense return empty arrays
- **THEN** `mergeByRRF` returns an empty array without error

---

### Requirement: Tier 3 fallback becomes FTS+dense hybrid in activity-api

The `getActivitiesWithTieredFallback` function in `src/routes/activities.ts` SHALL be updated so that when execution falls through to Tier 3 (currently FTS-only), it runs BM25 and dense search in parallel and merges with RRF before returning.

The updated Tier 3 flow SHALL be:

```
[BM25 results from queryActivitiesByFTS]  ─┐
                                            ├─ mergeByRRF ─> top-(limit*3) ─> return tier='fts_hybrid'
[Dense results from queryActivitiesByDense] ─┘
```

Both searches SHALL be launched with `Promise.all` so they run concurrently. The total added latency over BM25-alone SHALL be the greater of `embed(query)` time (~5 ms) and the cosine scan time — not their sum, because embedding and fetching can overlap.

If `EmbeddingService.isReady()` is false, the hybrid silently degrades to BM25-only and the tier is logged as `'fts'` (existing label, no new code path for callers).

The merged RRF pool replaces the raw BM25 result set before it enters Thompson Sampling reranking. Thompson Sampling is unaware of whether the pool came from BM25, dense, or hybrid — it sees a list of `ParadigmActivity` objects and applies its existing scoring logic unchanged.

#### Scenario: vocabulary-gap goal finds activity via dense

- **WHEN** `POST /v2/activities/recommend` is called with `task_description = "fix login bug"`
- **AND** Tier 1 and Tier 2 return fewer than `ceil(limit/2)` results
- **AND** the dense search returns "Resolve authentication error handling" at rank 1
- **THEN** "Resolve authentication error handling" appears in the merged pool fed to Thompson Sampling

#### Scenario: Thompson Sampling ordering preserved over RRF

- **WHEN** the RRF pool contains five activities and Thompson Sampling assigns different β-distribution scores
- **THEN** the final recommendation order is determined by Thompson Sampling scores, not RRF scores
- **AND** RRF serves only as a retrieval filter, not a final ranking signal

#### Scenario: dense model not ready at request time

- **WHEN** `EmbeddingService.isReady()` is false during a Tier 3 call
- **THEN** only BM25 runs, the result is returned with `tier: 'fts'`, and no error is surfaced to the caller

---

### Requirement: concept search uses FTS+dense hybrid

The `searchConcepts` function in `concept-db` SHALL be updated to run BM25 (`queryConceptsByFTS` using the existing indexes from `concept-db-bm25-search` spec) and dense search in parallel when `request.query` is non-empty, merging with `mergeByRRF`. If the query is empty, the existing `ORDER BY relevance DESC` path is unchanged. If the dense model is not ready, the function falls back to BM25-only without error.

#### Scenario: concept search bridges vocabulary gap

- **WHEN** `GET /concepts/search?query=authentication+problem` is called
- **AND** a concept exists with `content = "JWT token validation failure in auth middleware"`
- **THEN** that concept appears in search results even though "authentication problem" shares no token with "JWT token validation"

---

### Requirement: backfill job for existing templates and concepts

Both vessels SHALL include a one-shot background job that runs after model warm-up and writes embeddings for rows that have `name_embedding = NONE` (activity) or `content_embedding = NONE` (concept). The job SHALL:

1. Start automatically once `EmbeddingService.isReady()` becomes true, gated by a flag so it only runs once per process.
2. Query in pages of 50 rows (`LIMIT 50 START $offset`) to avoid memory spikes.
3. Embed each row's text fields using `EmbeddingService.embedBatch()`.
4. Write results with `UPDATE <id> SET name_embedding = $vec` (activity) or `UPDATE <id> SET content_embedding = $vec` (concept) in a single batch `UPDATE ... WHERE id IN $ids` where possible.
5. Log progress at `info` level every 250 rows: `[backfill] embeddings written: 250 / 1400`.
6. Continue even if individual rows fail (skip and log at `warn`).
7. On completion, log `[backfill] dense embedding backfill complete: N rows updated`.

The job SHALL be controlled by the `DENSE_BACKFILL_ENABLED` environment variable (default `true`). Setting it to `false` disables the job entirely, which is useful during canary validation to prevent background load.

#### Scenario: first deploy with 500 existing templates

- **WHEN** the updated server starts with 500 templates that have `name_embedding = NONE`
- **THEN** within a few minutes all 500 rows have non-null `name_embedding`
- **AND** the HTTP server is fully functional throughout (backfill is a background task)

#### Scenario: backfill skips already-embedded rows

- **WHEN** the server restarts after a partial backfill
- **THEN** only rows still missing embeddings are processed; already-embedded rows are not re-embedded
- **AND** `SELECT count() FROM activity WHERE name_embedding = NONE` decreases monotonically toward 0

#### Scenario: backfill disabled via env var

- **WHEN** `DENSE_BACKFILL_ENABLED=false`
- **THEN** no backfill queries run at startup, even if many rows lack embeddings

---

### Requirement: observability

Both vessels SHALL emit structured log entries at key points in the hybrid search path:

- `debug` on each call to `EmbeddingService.embed()`: `{ query_length, embed_ms }`
- `debug` on each cosine scan completion: `{ candidate_count, top_dense_score, scan_ms }`
- `info` on each RRF merge: `{ bm25_count, dense_count, merged_count, top_rrf_score }`
- `info` on Tier 3 path: `{ tier: 'fts_hybrid' | 'fts', bm25_count, dense_count }`

The `/health` endpoint in `metabob-activity-api` SHALL include an `embedding` block:

```json
{
  "embedding": {
    "status": "healthy" | "loading" | "disabled",
    "model": "all-MiniLM-L6-v2",
    "dim": 384,
    "backfill_pending": 42
  }
}
```

`backfill_pending` SHALL be a `SELECT count() FROM activity WHERE name_embedding = NONE` count, updated lazily (cached for 60 s). `concept-db` SHALL expose the equivalent count via its own `/health` endpoint.

#### Scenario: health check reflects backfill progress

- **WHEN** the backfill has written 300 of 500 embeddings
- **THEN** `GET /health` returns `"backfill_pending": 200`
- **AND** `"status": "healthy"` (partial backfill does not degrade health status)

---

## Out of scope

- HNSW approximate nearest-neighbour indexes in SurrealDB — brute-force scan is sufficient for the current fleet size and avoids index maintenance complexity.
- GPU inference or ONNX execution providers other than CPU.
- Tunable RRF `k` parameter exposed via API — fixed at 60 for the initial implementation.
- Per-field weighting within the dense score (name vs. description) — taking `max` is intentional; weighting can be introduced once recall data is available.
- Cross-vessel hybrid search (e.g., using concept-db embeddings to rank activity templates) — out of scope; each vessel searches its own table.
- Streaming embeddings or partial results.
- A/B testing of BM25-only vs. hybrid at the HTTP layer — Thompson Sampling naturally A/B tests activities end-to-end once the pool changes; no additional flagging mechanism is needed.
