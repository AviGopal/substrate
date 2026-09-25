# perf-2: activity-api dense activity retrieval (`queryActivitiesByDense`) — why ~30–200 s, and how to get to ms

Read-only investigation, 2026-09-25 ~07:45–07:55Z. 5 SurrealQL queries used (1× `INFO FOR TABLE activity`, 4× `SELECT … FROM activity … LIMIT 3 TIMEOUT 10s`; 2 of those errored on `array::len(NONE)` and did no work). One 5-min journal window (07:46:34–07:51:34Z, 40,553 lines) captured once to a temp file and since deleted. No writes, restarts, or edits.

**Note:** activity-api was restarted at 07:51:42Z (SIGTERM, graceful). I did not cause it. All latency stats below come from before the restart.

## TL;DR

- **Root cause (measured):** each `/recommend` call runs an unindexed full-table scan of `activity` for dense retrieval. `SELECT *` with an in-engine cosine, `ORDER BY` and `LIMIT` runs over every non-retired row. The query goes through the legacy `queryWithAuth` path, which opens a fresh authenticated client and evaluates row-level PERMISSIONS on every row. No vector index exists: `INFO FOR TABLE activity` lists 15 indexes and none is MTREE or HNSW. The HNSW branch is behind an env flag that is not set.
- **Where the time goes:** mostly in queueing (inferred, with strong evidence). The query is byte-identical in 102 of 107 calls, yet its latency ranged from 13 s to 197 s (avg 106 s, p50 106 s). That is up from avg 30 s at 07:32–07:42. A fixed-size scan does not vary 15× unless it is waiting in a queue. The arithmetic itself costs ~3 ms (4k × 2 × 384 MACs). The cost is reading ~4k rows of 10–20 KB each from blob files and deserialising them, multiplied by ~40–70 concurrent copies.
- **Dense is one of three scans per `/recommend` call.** In the window there were 193 Tier-1 `SELECT * FROM activity` calls (avg 7.8 s, max 19.9 s). Tier-1 **also returns both embeddings on every row**, about 16.5 MB of JSON per call. There were also 191 FTS calls, and all 191 timed out at 8 s. Recommend received 198 requests and returned 32 responses, which took ~60 s each.
- **Dense added no net candidates in 107 of 107 blends (measured).** It only reorders the list, but that reorder decides which cold template gets the exploration slot (inferred from the code). So it cannot simply be removed without a behaviour change.
- **Recommendation:** keep an in-process vector cache in activity-api and brute-force it: ~1–3 ms, ~12 MB. Then add `OMIT` of the embeddings to Tier-1 and FTS. HNSW ranks last: it has already been removed twice for exactly this write pattern.

---

## 1. The query, why it is a full scan, and who calls it

### Code

`/vessels/activity-api/src/db/paradigm.ts:1449` `queryActivitiesByDense(searchQuery, orgId, executionType, limit=50, jwtToken)`:

- **:1458–1463** embeds the query with `localEmbeddingService.embed()`. This is a local ONNX all-MiniLM-L6-v2 model producing 384 dimensions. Nothing is cached, so the same string is embedded again on every call.
- **:1475** `const hnswEnabled = process.env.DENSE_EMBEDDING_HNSW_ENABLED === 'true'`. This flag is **not set** in the activity-api process environment (checked in `/proc/<pid>/environ`), so the code always takes the scan branch at :1562. No `completed (hnsw)` lines appear in the logs. Because the gate is an env var, it breaks law 1.
- **:1585–1601** the scan that actually runs:

```sql
SELECT *,
  math::max([
    0,
    IF array::len(name_embedding) = $query_dim
      THEN vector::similarity::cosine(name_embedding, $query_vec) ELSE -1 END,
    IF array::len(description_embedding) = $query_dim
      THEN vector::similarity::cosine(description_embedding, $query_vec) ELSE -1 END
  ]) AS dense_score
  OMIT name_embedding, description_embedding
FROM activity
WHERE (name_embedding IS NOT NONE OR description_embedding IS NOT NONE)
  AND (retired = false OR retired IS NONE)
  [AND execution_type = $execution_type]
ORDER BY dense_score DESC
LIMIT $limit            -- limit*3 from the caller → 36 rows in the logs
```

  There is **no `TIMEOUT`**. By contrast, FTS uses `TIMEOUT 8s` and times out. The dense query runs until it finishes, up to 197 s in the window.
- **:1603–1605** runs the query through `queryWithAuth(jwtToken, …)` whenever a JWT is present, which it is for `/recommend`. In the window, 193 "Executing authenticated query" lines contain `name_embeddi…`. Each of those lines is ~8.8 KB because the logger prints `params`, including the 384-float `query_vec`.

### Why it is a full scan

- **No vector index.** `INFO FOR TABLE activity` (query 1, 6 ms) lists these indexes: `account_id, category, deprecated, fts_name (BM25), fts_tags (BM25), id UNIQUE, input_shapes, name, org, org_type, output_shapes, public+scope, scope, type, variant_of`. None is MTREE or HNSW, including on the Qwen `embedding` field that `queryActivitiesByEmbeddingDense` expects to be indexed as `idx_activity_embedding_hnsw`.
- **History of the HNSW index.**
  - Migration `106-hnsw-dense-embedding-index.surql` defined two HNSW indexes.
  - Migration `110-drop-hnsw-indexes.surql` removed them. Its stated reason was an OOM loop: full-table `UPDATE … updated_at` on restart forced both HNSW graphs to be re-evaluated.
  - Migration `125-remove-hnsw-activity-indexes.surql` removed them again. Its stated reason was that HNSW maintenance on every INSERT/UPDATE reached "1386m+ CPU sustained, causing 30s timeouts on … all concurrent SurrealDB queries".
- **No index can help the scan query.** The predicates `IS NOT NONE`, `retired = false OR retired IS NONE`, and an `ORDER BY` on a computed value cannot use any index, so SurrealDB iterates every record in the table.
- **`OMIT` does not reduce the read.** `OMIT` only strips fields from the *output*. SurrealDB stores each record as one serialized document value, so the full row, including both 384-float arrays, is fetched from RocksDB (blob files for values over 4 KB) and deserialised before `OMIT` is applied.
- **PERMISSIONS run on every row.** The query runs under a record-access JWT session, so the `activity` table's `FOR select` predicate (migration `099-account-id-permissions.surql:50`) is evaluated on every row. The predicate is `scope = 'global' OR org_id IS NONE OR ($token.account_id … ) OR (account_id IS NONE AND (org_id = $token.org_id OR org_id = <string>$token.org_id))`.

### Row size (sampled, query 4: 3 rows, 34 ms)

| field | elements | chars as text |
|---|---|---|
| `name_embedding` | 384 | ~8,870 |
| `description_embedding` | 384 | ~8,880 |
| `embedding` (Qwen/OpenAI) | 0 (`[]`) | 2 |
| `tasks` | – | 1.8–6.5 K |
| `description` | – | 260–340 |

So every row carries **two 384-dim vectors (~6 KB as f64 in storage, ~17.7 KB as JSON)** plus tasks and text. The scan needs only `id`, one or two vectors, and 4–5 filter columns, but it reads the entire row. The `embedding` column is empty on the sampled rows, while its `embedding_model` default still says `text-embedding-3-small`.

### Who calls it, and how often

Callers are all in `/vessels/activity-api/src/routes/activities.get-activities-with-tiered-fallback.ts`:

- **:104–108** is the Tier-1 blend. When Tier 1 (shape match) already returns at least `minResults` **and** a goal description exists, the code runs `Promise.all([FTS, Dense])` and prepends the RRF-merged hits. **This is the only branch that fired in the window:** 107 blend lines, all `tier: exact`.
- **:193–195** is Tier-3-first (no or insufficient shapes). It fired 0 times.
- **:292–294** is the Tier-3 fallback. It fired 0 times.

`getActivitiesWithTieredFallback` has a single caller: `POST /v2/activities/recommend` (`routes/activities.ts:6201`). **So there is one dense scan per `/recommend` call.** Callers of `/recommend` include goal-host-vessel (walk producer selection), ias-executor-ts (`adapters/activity-api-{provider,adapter}.ts`, `resolvers/llm-prompt.ts`), and development-vessel (`selector/index.ts`, `resolvers/activity-recommend.ts`, several seeds). I did not measure how many `/recommend` calls a single goal walk makes. In the window, **187 of 198** recommend requests carried the same task description (`learning-loop-selftest: exercise the execution→l…`), and 102 of 107 dense queries were the same string.

The Qwen path, `queryActivitiesByEmbeddingDense` (paradigm.ts:~1652, called from `routes/impulses.ts:4129`), logged 0 lines in the window. It targets an index that does not exist.

---

## 2. Where the time goes

Measured, 07:46:34–07:51:34Z (5 min):

| stage | calls | latency |
|---|---|---|
| `POST /recommend` requests received / responses sent | 198 / 32 | responses 58–68 s |
| Tier 1 `queryActivitiesByShapes` (`SELECT * FROM activity … ORDER BY ev DESC, created_at DESC LIMIT 1000`) | 193 | avg 7.8 s, p50 7.4 s, max 19.9 s |
| FTS `queryActivitiesByFTS` | 191 | **191/191 failed:** "exceeded the timeout" (8 s) |
| Dense `queryActivitiesByDense` (scan) | 107 completed | **avg 105.7 s, p50 106.3 s, p90 168 s, max 197 s, min 13.4 s** |

The briefing's 07:32–07:42 figure was 297 calls averaging 29.8 s with a max of 96 s. The same query on the same table became 3.5× slower within 15 minutes, so latency is driven by load, not by the per-query work.

Rough decomposition (inferred from sizes and counts; not benchmarked):

1. **Similarity arithmetic: negligible.** 4,003 rows × 2 × 384 multiply-adds is about 3 M flops, roughly 1–5 ms even inside SurrealDB's interpreter. The one real cost here is materialising `Vec<Value>` for 768 numbers per row, about 3 M `Value` allocations per query, which is in the tens of ms to low hundreds of ms.
2. **Row reads and blob I/O: the per-query floor.** Each query reads ~4k documents of ~10–20 KB each, about 40–80 MB, stored as values over 4 KB in RocksDB blob files. The store is 46 GB with ~89% garbage and blob GC off (TRACE-STORE-GROWTH.md), so these reads are scattered and compete for page cache with trace blobs. Uncontended and cache-warm this is probably 100–500 ms. Cold and scattered, it is seconds.
3. **Per-row PERMISSIONS evaluation** of the `FOR select` predicate on ~4k rows. This is a constant factor I could not isolate.
4. **Connection setup.** `queryWithAuth` takes the legacy path, which opens a new client, signs in and authenticates for every query (`db/surreal.ts:392`; the code comment says ~200–300 ms cold). It also logs a ~8.8 KB line per query.
5. **Queueing and contention: the dominant term.** By Little's law, 0.36 dense completions/s × 106 s ≈ **38 concurrent dense scans** (arrival rate 0.66/s gives ~70). Each `/recommend` also runs a Tier-1 scan and an FTS scan, so the window held ~491 table-level reads of `activity` in 300 s. Every one of them contends with trace inserts (1,886 "query failed" lines in the window, mostly `INSERT INTO trace_digest/execution/execution_trace_content`) for SurrealDB's ~11 cores and the blob-file I/O. Clients time out at ~60 s and the handlers keep running (198 received vs 32 answered), so abandoned scans keep holding capacity.

**The larger payload is Tier 1, not dense.** `queryActivitiesByShapes` (paradigm.ts:~867) is `SELECT * FROM activity` with **no OMIT**. It returns ~928 rows, each carrying both vectors, which is ≈ 928 × 17.7 K ≈ **16.5 MB of JSON per call** and ~3 GB serialised, sent and parsed in 5 minutes. Fixing only dense would bring `/recommend` from ~60 s down to about the Tier-1 time (~8 s under the current load). Reaching ms requires the same treatment for Tier 1.

**FTS is effectively dead.** It timed out on all 191 calls. So "hybrid" retrieval has been dense-only, and `ftsCount: 0` appears in every blend line.

---

## 3. Does dense change the final pick?

Blend log lines in the window (107 of 107): `tier1Count` ∈ {926…943}, `denseCount: 36`, `blendedTotal = tier1Count + 22…25`, **`feasibleCount == tier1Count` in every line**, and `chosenCount == feasibleCount`.

- **Measured:** the 22–25 dense-only hits were always shape-infeasible and were removed by `filterBySatisfiableInputShapes`. The remaining ~11–14 dense hits were already in the Tier-1 set. **Dense added no candidate in any of 107 blends.** Its only effect is that those ~14 rows move to the front of the ordered list.
- **Inferred, the reorder still matters.** Ranking happens at `routes/activities.ts:7272–7309`, where the exploration and exploitation pools are sorted by `_ucb_score`. `ucbScore(n, mean) = mean + sqrt(2·ln N / max(n,1))` (:6724) is deterministic. Cold arms (n = 0, mean 0 per the comment at :6729ff) all tie exactly. JS `Array.prototype.sort` is stable, so tied arms keep their input order. **The first cold arms in input order, which are the dense-preferred ones, take the `reserved` exploration slots and the `headColdFill`.** Dense therefore steers exploration among ~600 cold candidates, and removing it would make exploration follow `created_at DESC`, the Tier-1 order. I could not verify this from `thompson_selection_log` within the query budget.
- Conclusion: "remove the tier" is not free. "Restrict dense to reordering the Tier-1 set" is behaviourally identical to today, as measured. That is the basis for option B.

---

## 4. Are the embeddings rewritten often? (blob churn)

- **The embeddings are not recomputed often.** They are written:
  - by the fire-and-forget code after `POST /templates` (`routes/activities.ts:1051–1066`), which runs after an `UPSERT … CONTENT` (:886) that replaces the whole row. So each registration causes two full-document writes plus two ONNX embeds.
  - by the startup backfill (`src/index.ts:780–840`) for rows `WHERE name_embedding IS NONE`. This is a scan on every start, and its paging has a bug: `START $offset` advances while the filter set shrinks, so it skips rows.
- **They are rewritten as collateral constantly.** `updated_at` is `VALUE time::now()`, and any `UPDATE activity SET x` rewrites the entire document, including ~6 KB of vectors, into a new blob and leaves the old one as garbage. Writers include:
  - **The learning-track classifier** (`jobs/learning-track-classifier.ts:122, 147`, scheduled at `src/index.ts:1005–1025`). It runs **on every activity-api start and then every 6 h**. It selects up to **2,000** templates that are due (:171–173) and writes `last_classified_at` for each, **even when the classification does not change**. Query 5 found 3 of 3 sampled rows with `last_classified_at` = `updated_at` (within ~3 ms), both at 07:16:27–07:17:28 today, with `learning_track: "unclassified"`. A sweep was in progress during that minute. At ~15 KB per row, one sweep produces ≈ 30 MB of new blob garbage on the activity table. It also re-runs on every restart, including the one at 07:51.
  - `proposed = false` promotion (`routes/activities.ts:3866, 4578`). This uses `WHERE meta::id(id) = $tid`, which is itself a **full-table scan** per call, because `meta::id()` is not an index lookup.
  - retire/fail-out (`routes/activities.ts:3825`), `UPDATE activity MERGE` (`routes/impulses.ts:3241`), deprecate (`impulses.ts:3379`), and the variant-creator (`services/variant-creator.ts:420, 528`).
- The embeddings are the largest part of the row, so every metadata-only write copies them. Row slimming (option C) fixes this class of churn.

---

## 5. Designs, ranked

### A. In-process vector cache in activity-api (recommended)

- **What.** Keep `Map<id, {nameVec: Float32Array, descVec: Float32Array|null, scope, org_id, account_id, retired, execution_type, input_shapes}>`, or a packed `Float32Array(N×384)` per field plus parallel metadata arrays. Vectors are already L2-normalised (per the field comment), so cosine is a dot product. Load it once at startup with a paginated `SELECT id, name_embedding, description_embedding, scope, org_id, account_id, retired, execution_type, input_shapes FROM activity … LIMIT 500 START n`, run as root off the request path. That is one scan per start instead of one per request.
  - **Query:** embed the query (with the LRU from option E), take dot products over all N rows, keep a partial top-K, apply the tenancy, retired and type filters in JS, and return `{id, dense_score}`.
  - **Hydrate:** for the Tier-1 blend (:104), all surviving hits are already in `tier1Result.data`, so hydrate by id from that array with zero DB work. For Tier-3 paths, hydrate the ≤ 36 ids with `SELECT … OMIT name_embedding, description_embedding FROM $ids` (record-id lookup, indexed).
- **Expected latency.** 4k × 768 MACs is ~1–3 ms in V8/Bun, plus ~5–15 ms for the ONNX query embed, or ~0 on a cache hit (102 of 107 queries in the window were identical). **p50 ~2 ms, p99 < 10 ms** with a hit; the embed dominates on a miss.
- **Memory.** 4,003 × 2 × 384 × 4 B ≈ **12.3 MB**, plus ~1 MB of metadata. It grows linearly and stays small even at 50k rows (~150 MB), at which point switch to an in-process HNSW (hnswlib-node or usearch).
- **Staleness semantics.**
  - Write-through invalidation from the same-process write sites: the embed code at `activities.ts:1051` and `index.ts:821`, the retire and deprecate sites (`activities.ts:3825`, `impulses.ts:3379`), and `UPSERT … CONTENT` (`activities.ts:886`, `:7995`).
  - A periodic reconcile using an indexed `updated_at > $last_sync` delta, which needs an index on `updated_at` or a `LIMIT`-paged `SELECT … WHERE updated_at > $t`. Its cadence must be a **shaped tuning row** read at use time, following the `resolveThompsonDecayHalfLifeDays` pattern (activities.ts), not an env var.
  - Writes made by other processes, such as development-vessel minting via activity-api's routes, still pass through activity-api. Only direct DB writers are stale, for at most one reconcile period.
  - Stale state in practice means: a brand-new template is invisible to dense for ≤ one period (it still enters through Tier 1 and FTS), and a retired template can surface, but the downstream `retired` filter in Tier 1 and the selection gates still apply.
- **Tenancy (the load-bearing risk).** The cache is read as root, so the table `FOR select` PERMISSIONS no longer run on the dense path. Replicate the predicate in the app layer exactly, as `queryActivitiesByEmbeddingDense` (paradigm.ts:~1680–1710) already does for the KNN path. In the Tier-1 blend path the risk is contained: hydration comes from `tier1Result.data`, which **was** fetched under the JWT and PERMISSIONS, so any cache hit not in that set is dropped.
- **Files.**
  - New: `src/db/dense-vector-cache.ts`.
  - `src/db/paradigm.ts:1449–1628`: add a `dense_search_method: 'cache'` branch; keep the scan as fallback while the cache is cold.
  - `src/routes/activities.get-activities-with-tiered-fallback.ts`: hydration from Tier 1.
  - Invalidation hooks at `src/routes/activities.ts:886/1051/3825/7995`, `src/routes/impulses.ts:3241/3379`, and `src/index.ts:821`.
  - Startup wiring in `src/index.ts`.
- **Risk.** Low to medium: a tenancy predicate drift, and cold-start fallback behaviour. The startup load is a one-off full read, so it must not run in a restart storm. Run it with a jittered delay and paging.
- **Falsifier.**
  1. On a canary, run a shadow comparison for N = 200 queries: top-36 id-set Jaccard between cache and scan should be ≥ 0.95, with identical order on non-tied scores.
  2. `[paradigm] queryActivitiesByDense: completed (cache)` p99 < 10 ms.
  3. The blend lines keep `feasibleCount == tier1Count` with the same prefix order.
  4. `thompson_selection_log` pick distribution is unchanged at a fixed seed.

  If (1) fails, the cache is missing rows or the filter drifted.

### B. Restrict dense to the Tier-1 set in the blend path (cheapest; complements A)

- **What.** At `tiered-fallback.ts:104–108`, Tier 1 already holds the ~930 candidates. Score only those: `dot(queryVec, row.name_embedding)` in JS. The Tier-1 rows **already carry both embeddings**, because Tier 1 is `SELECT *` without `OMIT`, so this costs zero extra DB work. The outcome is measured-identical to today: dense added no candidates in 107/107 blends and only reorders.
- **Expected latency.** ~1 ms of arithmetic plus the query embed. Dense leaves the DB entirely on the only path that fires today.
- **Memory.** None beyond what Tier 1 already loaded.
- **Staleness.** None: it uses the same rows Tier 1 just read under PERMISSIONS.
- **Files.** `src/routes/activities.get-activities-with-tiered-fallback.ts` (blend branch), plus a small `scoreRowsByDense(rows, queryVec)` helper in `src/db/paradigm.ts`.
- **Risk.** Very low. It is not usable together with option D (OMIT on Tier 1) unless Tier 1 keeps `name_embedding` or option A supplies the vectors. That is why A is the durable version.
- **Falsifier.** Over a window, the blend-line `chosenCount` and the first-K ids of the chosen order match the scan-based ordering on shadowed calls. The `/recommend` response time drops from ~60 s to ~Tier-1 time.

### C. Move embeddings to a side table (`activity_embedding`, keyed by activity id)

- **What.** A slim `activity_embedding:{id}` holding `{name_vec, desc_vec, model, updated_at}`. `activity` loses ~6 KB of vectors per row, so every metadata-only UPDATE (the classifier sweep, promote, retire, MERGE) stops copying the vectors into new blobs.
- **Expected latency.** A scan of the side table alone reads ~4k × ~6.5 KB ≈ 26 MB with no PERMISSIONS on the main table. That is perhaps 100–500 ms uncontended, **not** ms, so on its own this is insufficient. Its value is **(a)** Q4 churn reduction, **(b)** every other `SELECT *` on `activity` getting ~2–3× lighter (Tier 1, FTS, `discover-by-shapes`), and **(c)** a cheap source for A's startup load.
- **Memory.** Neutral.
- **Staleness.** Transactional, with no staleness.
- **Files.** A new migration `sql/migrations/NNN-activity-embedding-side-table.surql` (DEFINE TABLE, copy, then remove fields). Writers: `src/routes/activities.ts:1051–1066`, `src/index.ts:780–840`. Readers: `src/db/paradigm.ts` dense functions.
- **Risk.** Medium. It needs a DB migration with a full-table copy, which must **not** run during the graded run or while the store is saturated. Schema and PERMISSIONS on the new table must be mirrored.
- **Falsifier.** The mean stored size of an `activity` row drops by ≥ 6 KB. After one classifier sweep, blob-file bytes written to the activity keyspace per sweep drop ~40%, observed through RocksDB stats or the store-growth monitor.

### D. `OMIT name_embedding, description_embedding, embedding` on Tier 1 and FTS

- **What.** Add the `OMIT` to `queryActivitiesByShapes` (paradigm.ts:~867) and to `queryActivitiesByFTS` (paradigm.ts:~1378). This removes ~16.5 MB of JSON per `/recommend` from SurrealDB serialisation, the network, and Bun `JSON.parse`. It does not reduce reads, because OMIT still reads the full document.
- **Expected latency.** Tier 1 drops by roughly the serialisation share, probably 7.8 s → a few s under load. This is the second-largest win for `/recommend`.
- **Risk.** Low. Check that no downstream code reads `name_embedding` from recommend candidates; my grep of `routes/activities.ts` found none. This conflicts with option B unless A exists.
- **Falsifier.** Tier-1 `latency_ms` avg falls, and `/recommend` response bytes and activity-api RSS churn fall.

### E. Cache query embeddings (LRU keyed by the trimmed query string)

- **What.** An LRU of about 1–5k entries: `Map<string, Float32Array>`.
- **Expected latency.** It saves the ONNX embed, roughly 5–20 ms on CPU and more under load 31, on each hit. 102 of 107 dense queries in the window were identical, and 187 of 198 recommend descriptions were identical.
- **Memory.** 1.5 KB per entry.
- **Staleness.** None, because the model is fixed.
- **Files.** `src/services/local-embedding*.ts`, or wrap the call at paradigm.ts:1462.
- **Risk.** Nil.
- **Falsifier.** An embed-time histogram, or a hit ratio above 0.9 on the self-test stream.
- It is **not** where the 30–200 s goes, but it is required for A to reach sub-10 ms p99.

### F. SurrealDB HNSW index plus the `<|K,EF|>` KNN operator (rank last)

- **Expected latency.** Low-ms KNN in principle.
- **Why last.**
  - It was already removed **twice** for this exact workload: migration 110 (OOM loop from a restart-time full-table UPDATE times index maintenance) and migration 125 (1.4 cores sustained per INSERT, 30 s timeouts on all queries).
  - The classifier's ≤ 2,000-row UPDATE sweep on every start, plus the other per-row UPDATEs, recreate the migration-110 trigger. HNSW maintenance runs on any row write, not only on vector changes. Option C removes that coupling, and option F should not be revisited before C.
  - This codebase documents SurrealDB 2.3.3 quirks (paradigm.ts:~1680–1730): KNN returns **0 rows under a record-access JWT**, `<|K,EF|>` does **not compose** with sibling WHERE predicates (the K-limit is dropped and the query degrades to a scan, or an OR returns 0 rows), and bound params for K/EF or the vector are rejected. So it needs a root-authed two-stage query with app-side tenancy, the same tenancy burden as A without A's simplicity.
  - `DEFINE INDEX` today means an index build over 4k blob-stored rows on a saturated 46 GB store.
- **Memory.** Server-side: graph plus vectors, ~4k × (384 × 4 + M × 8 × 2) ≈ 10–15 MB per index, plus build peaks.
- **Staleness.** Transactional.
- **Files.** A new migration, the `DENSE_EMBEDDING_HNSW_ENABLED` gate at paradigm.ts:1475 (replace it with a shaped policy), and query rewrites.
- **Risk.** High, with a history of incidents.
- **Falsifier.** Under a load replay, `completed (hnsw)` p99 < 20 ms **and** activity-api/SurrealDB CPU during a classifier sweep does not rise by more than 10% versus no index.

### G. Remove the dense tier

- Measured: it adds no candidates. Inferred: it decides which cold arms get exploration slots, through the stable-sort tiebreak in UCB. Removing it silently changes exploration, which then follows Tier 1's `created_at DESC` order, and breaks causal discipline (law 12) unless the change is recorded as a deliberate intervention.
- **Not recommended.** Option B gives the same speed with no behaviour change.

### Recommended order

1. **B + E**: code-only, zero DB impact, removes the dense scan from the only live path. Expect `/recommend` to go from ~60 s to about the Tier-1 time.
2. **A**: durable ms dense retrieval for every path, including Tier 3.
3. **D**: after A, removes the 16.5 MB-per-call Tier-1 payload.
4. **C**: in a maintenance window, to stop churn on metadata writes.
5. **F**: only if N grows past ~50k, and only after C.

Also fix the classifier so it does not write `last_classified_at` when nothing changed. That write is pure churn.

---

## 6. Risks and landmines found along the way

- **`src/db/surreal.ts:384`: the pooled `queryWithAuth` ignores `sql`.** It runs a hard-coded `SELECT id, name, description, content, created_at, updated_at FROM template` and returns those rows for *every* authenticated query. It is dormant only because `DB_POOL_ENABLED` is unset (checked in the process environment). Anyone who enables the pool to save the ~200–300 ms handshake would break every JWT query in activity-api. Fix this before touching the auth path.
- **Env-gated hot-path behaviour** (`DENSE_EMBEDDING_HNSW_ENABLED`, `DB_POOL_ENABLED`, `LEARNING_TRACK_CADENCE_MS`, `DENSE_BACKFILL_ENABLED`) breaks law 1. Any new cadence or refresh knob for option A should be a shaped tuning row.
- **`queryWithAuth` logs full `params` at INFO** (~8.8 KB per dense call, because it includes the 384-float vector). This feeds the ~140 lines/s log volume.
- **The dense scan has no `TIMEOUT`**, unlike FTS (8 s). Abandoned `/recommend` handlers keep 100–200 s scans running after the client has gone.
- **`UPDATE activity … WHERE meta::id(id) = $tid`** (`activities.ts:3866, 4578`) is a full-table scan per promote. Use `UPDATE type::thing('activity', $tid)`. The comment there claims backtick UPDATE "finds no records", but `activities.ts:1062` and `index.ts:828` use `type::thing` or `type::record` successfully.
- **The embedding backfill's paging** (`index.ts:803`: `WHERE name_embedding IS NONE … START $offset`) skips rows as the filtered set shrinks, and it runs a scan on every start.
- **`queryActivitiesByEmbeddingDense`** (Qwen, 1024-dim) targets `idx_activity_embedding_hnsw`, which does not exist. The sampled rows have `embedding: []`. That path is dead.

## 7. Not measured

- The split of a single scan between blob reads, deserialisation, and PERMISSIONS evaluation. That would need a benchmark or profiling on the live DB, which is forbidden during the run.
- SurrealDB's internal queue depth and concurrency. It is inferred via Little's law from log arrival and completion rates.
- How many `/recommend` calls one goal walk makes. The stream in the window was dominated by one self-test description.
- Whether the dense reorder actually changed exploration picks. This needs `thompson_selection_log`, which was outside the query budget.
- The exact mean stored row size across the table (3-row sample only) and the true count of rows with embeddings.
- What triggered the 07:16 classifier sweep. There were no activity-api SIGTERMs between 07:00 and 07:30, so it was either the 6 h tick or a sweep that started earlier.
