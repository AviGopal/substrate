# Tasks: SurrealDB 3.x RL Layer

**Change ID**: `2026-04-29-surrealdb-rl-layer`

---

## Phase 1 — Atomic α/β Updates (~1 day)

**Goal**: eliminate all fetch-modify-write sequences in α/β posterior update paths. SurrealDB 3.0 SSI guarantees no lost increments under concurrent writes.

- [ ] 1.1 Fix `execution-traces.ts:1938` — replace fetch+merge for `activity_template` Thompson posterior with `UPDATE ... SET thompson_alpha += $da, thompson_beta += $db`. Log `atomic_update: true` alongside the existing update line.
- [ ] 1.2 Fix `activities.ts:3599` — feedback positive path for `impulse_shape_activity_score`. Same atomic `+=` pattern.
- [ ] 1.3 Fix `activities.ts:3639` — feedback negative path for `impulse_shape_activity_score`. Same pattern.
- [ ] 1.4 Fix `goal-paths.ts:402` (`recordPathExecution`) — `goal_execution_paths` α/β update. Same pattern.
- [ ] 1.5 Audit remaining α/β update paths — `grep -rn 'thompson_alpha\|thompson_beta\|\.alpha\s*=\|\.beta\s*='` in `repos/metabob-activity-api/src/` and confirm no remaining fetch-modify-write sequences. Document any sites found or explicitly confirm zero remaining sites.
- [ ] 1.6 Unit tests: test concurrent update correctness for each of the four fixed sites. For each site: issue N concurrent updates with delta 1, assert final value equals initial + N (no lost increments). Pass with N ≥ 10.
- [ ] 1.7 Canary smoke: before/after comparison of `thompson_alpha + thompson_beta` sum on a heavily-used template after a burst of 5 concurrent execution traces. Confirm final sum matches expected.

**Acceptance criteria**:
- `bun run typecheck` clean in `repos/metabob-activity-api`
- Existing α/β update test suites green
- New concurrent-update tests added and passing
- Canary smoke confirms no lost increments on concurrent trace submission

---

## Phase 2 — BM25 Bound-Param Fix (~0.5 day)

**Goal**: fix the BM25 search bug that causes Tier 3 search to silently return zero results for any parameterised query. This phase ships before P2/P3/P4 to unblock search correctness independently.

- [ ] 2.1 Apply inline-literal fix to `paradigm.ts:998` — strip BM25-unsafe characters (`'`, `"`, `\`) from query string and inline as quoted literal. Confirm the fix matches the pattern used in `concept-db`'s 2026-04-29 fix.
- [ ] 2.2 Add a unit test: BM25 search returns non-zero scores for a template whose `name` field contains the query terms. Confirm zero results before fix (replicate bug) and non-zero after.
- [ ] 2.3 Deploy to canary and monitor `bm25_result_count` log field. Confirm non-zero counts on at least 5 Tier 3 search calls via the recommend endpoint.
- [ ] 2.4 Monitor for regression in Tier 3 fallback: existing tests that exercise hybrid search should still pass. Confirm no new false positives from the sanitised literal interpolation.

**Acceptance criteria**:
- BM25 search returns non-zero results for queries matching activity template names/descriptions
- No regression in existing Tier 3 search test suite
- Canary log shows `bm25_result_count > 0` on real queries

---

## Phase 3 — COMPUTED `ev` Field (~1 day)

**Goal**: expose expected value `ev = alpha / (alpha + beta)` as a read-time COMPUTED field on all 8 tables carrying α/β. Simplify the recommend endpoint's JS ranking loop.

- [ ] 3.1 Write migration: `DEFINE FIELD ev ... COMPUTED alpha / (alpha + beta) TYPE float` on all 8 tables. Use `DEFINE FIELD OVERWRITE` for idempotency. Tables: `activity_template`, `goal_execution_paths`, `context_thompson_scores`, `impulse_shape_activity_score`, `variant_performance_metrics`, `discovered_state_pattern`, `activity_state_affinity`. Add `composition_edge` (RELATE table, P4) here as a forward reference — migration runs at P4 time.
- [ ] 3.2 Verify COMPUTED fields update on α/β writes. Unit test: write α=3, β=1 to a test row; read back `ev`; assert `ev == 0.75`. Repeat for the atomic `+=` path (P1 fixes) to confirm COMPUTED updates on increments.
- [ ] 3.3 Update recommend endpoint (`activities.ts` ranking section): add `ORDER BY ev DESC` to the Tier 1 SQL query; remove the JS `alpha/(alpha+beta)` re-computation in the main sort loop. The 9 heuristic boosts remain in JS over the pre-sorted set.
- [ ] 3.4 Fallback: if `ev` field is absent on a returned row (canary/production version skew during deploy window), fall back to JS `row.alpha / (row.alpha + row.beta)`. Log `ev_computed_field: false` when fallback is used.
- [ ] 3.5 Cache invalidation review: confirm Redis cache TTL behaviour is unchanged. COMPUTED `ev` is derived at read-time from α/β — no new cache invalidation needed. Document this explicitly in a code comment at the cache write site.

**Acceptance criteria**:
- `bun run typecheck` clean
- `ev` field reads correctly on all 8 tables in integration tests
- Recommend endpoint ranking test: template with α=9, β=1 (ev=0.9) ranks above template with α=1, β=9 (ev=0.1)
- No cache invalidation regressions

---

## Phase 4 — `fn::beta_sample` Stored Function (~2 days)

**Goal**: implement true Beta distribution sampling as a SurrealDB stored function. Move the Thompson sampling call from app-side `@stdlib/random-base-beta` to `fn::beta_sample()` with app-side fallback.

- [ ] 4.1 Write migration: `DEFINE FUNCTION fn::beta_sample($a: float, $b: float) -> float` with the Marsaglia-Tsang Gamma sampling algorithm (Cheng's rejection method). Verify function syntax compiles on SurrealDB 3.0 by testing against the canary SurrealDB instance directly (`POST /sql`).
- [ ] 4.2 Deploy function to canary and verify sampling distribution. Issue 1000 calls to `SELECT fn::beta_sample(2.0, 5.0)` and confirm the resulting distribution has mean ≈ 2/(2+5) = 0.286 ± 0.05. Log `sample_source: "db"`.
- [ ] 4.3 Dual-compute at `activities.ts:4416`: call both `fn::beta_sample` (via DB query) and `betaSample()` (app-side `@stdlib`). Log both values and `sample_source`. Both code paths active; DB result discarded for now.
- [ ] 4.4 A/B compare distributions over 1000 samples. Run KS test between DB fn and @stdlib output for `Beta(2,5)`, `Beta(0.5,0.5)`, and `Beta(10,1)`. Promote once all three have KS p-value > 0.05.
- [ ] 4.5 Remove @stdlib call at `activities.ts:4416` once distribution comparison passes. Replace with DB-only path. Fallback: `try { db fn } catch { betaSample() }`. Add `sample_source: "app_fallback"` to fallback log.

**Acceptance criteria**:
- `fn::beta_sample` defined in DB and callable from SurrealQL
- Distribution comparison: KS p-value > 0.05 for all three Beta parameter sets
- App-side fallback works when DB function unavailable
- `bun run typecheck` clean after @stdlib removal

---

## Phase 5 — RELATE Edges for Composition Graph (~3 days)

**Goal**: migrate the composition graph from the `activity_composition_graph` join table to `RELATE activity_template:A->composes->activity_template:B` edges with α/β fields and shape arrays. Reduce `discover-by-shapes` from 21 queries per call to 1-2.

- [ ] 5.1 Write migration: `DEFINE TABLE composes SCHEMAFULL` with fields `alpha` (float, default 1.0), `beta` (float, default 1.0), `input_shapes` (array<string>), `output_shapes` (array<string>), `execution_count` (int, default 0), `success_count` (int, default 0), and COMPUTED `ev` field. Add unique index on `(in, out)` to prevent duplicate edges.
- [ ] 5.2 Backfill script: iterate `activity_composition_graph` rows, create one `RELATE` edge per row. Set `alpha = success_count + 1`, `beta = execution_count - success_count + 1` (uniform prior + counts). Set `input_shapes` and `output_shapes` from `composition_impulse_flow` rows for the same `(parent_activity_id, child_activity_id)` pair. Log count of edges created.
- [ ] 5.3 Dual-write: update `storeExecutionTrace` and `recordComposition` to write both `activity_composition_graph` (existing) and the new RELATE edge (new). Run for at least 7 canary days to accumulate evidence.
- [ ] 5.4 Rewrite `discover-by-shapes` to use graph traversal query (see design §5). Run old query and new query in parallel; compare result sets and ordering. Log `edge_query_count` (new path) and `old_query_count` (old path) per call. Promote new path once result sets match on 100 consecutive calls.
- [ ] 5.5 Compare query counts and latency on canary: log `edge_query_count` post-migration. Confirm drop from ~21 to ≤2 per `discover-by-shapes` call on the canary trace logs.
- [ ] 5.6 Deprecate `activity_composition_graph` and `composition_impulse_flow`: after 7 days of stable RELATE-only reads, remove dual-write, add `-- DEPRECATED` comment to the old table DDL, and log a warning if any code still reads the old table. Full deletion deferred to a follow-up migration once deprecation window passes.

**Acceptance criteria**:
- RELATE edges created for all existing composition graph rows (confirmed via `SELECT count() FROM composes`)
- `discover-by-shapes` query count ≤ 2 per call (logged on canary)
- Result-set comparison: new and old paths return the same top-10 activities on 100 consecutive canary calls
- `bun run typecheck` clean
- No regression in existing composition graph tests

---

## Phase 6 — HNSW Indexes (~1 day)

**Goal**: add HNSW vector indexes on 384-dim embedding fields. Switch dense search in `paradigm.ts` from O(n) full-table cosine scan to O(log n) KNN operator. Gate behind `DENSE_EMBEDDING_HNSW_ENABLED` env var initially.

- [ ] 6.1 Write migration: `DEFINE INDEX activity_name_embedding_hnsw ON TABLE activity_template FIELDS name_embedding HNSW DIMENSION 384 DIST COSINE EFC 150 M 16` and matching index for `description_embedding`. Note: SurrealDB builds HNSW indexes asynchronously on an existing corpus; the migration should log index-build status and the endpoint should handle the case where the index is not yet built (fall back to scan).
- [ ] 6.2 Add `DENSE_EMBEDDING_HNSW_ENABLED` env var to `repos/metabob-activity-api/src/config.ts`. Default: `false`. When `true`, switch `paradigm.ts:1103` dense search to use `<|k,ef|>` KNN operator. When `false`, keep existing O(n) scan path.
- [ ] 6.3 Rewrite `paradigm.ts:1103-1180` dense search under the feature flag: replace the in-process loop with `SELECT id, vector::similarity::cosine(name_embedding, $q_vec) AS score FROM activity_template WHERE name_embedding <|${k},${ef}|> $q_vec`. Update the hybrid RRF query to use both fixed BM25 and HNSW results.
- [ ] 6.4 Deploy to canary with `DENSE_EMBEDDING_HNSW_ENABLED=true`. Log `dense_search_latency_ms` and `dense_search_method: "hnsw" | "scan"`. Benchmark at current corpus size (~N templates). Confirm latency improvement vs. scan baseline.
- [ ] 6.5 Promote `DENSE_EMBEDDING_HNSW_ENABLED=true` as the default once HNSW results match scan results on 100 consecutive queries (rank correlation ≥ 0.95) and latency improvement is confirmed.

**Acceptance criteria**:
- HNSW indexes defined and built on canary (confirmed via `INFO FOR TABLE activity_template`)
- Dense search latency logs show `hnsw` method when flag enabled
- Rank correlation between HNSW and scan results ≥ 0.95 on 100 canary queries
- `bun run typecheck` clean
- Scan fallback still functional when flag is `false`

---

## Cross-Phase: Observability Checklist

The following log fields should be present by the end of all phases. Verify each in canary traces:

- [ ] `atomic_update: true` on α/β write calls (Phase 1)
- [ ] `bm25_result_count: N` on Tier 3 search calls (Phase 2)
- [ ] `ev_computed_field: true | false` on recommend calls (Phase 3)
- [ ] `sample_source: "db" | "app" | "app_fallback"` on Thompson sampling calls (Phase 4)
- [ ] `edge_query_count: N` on `discover-by-shapes` calls (Phase 5)
- [ ] `dense_search_latency_ms: N` and `dense_search_method: "hnsw" | "scan"` (Phase 6)
