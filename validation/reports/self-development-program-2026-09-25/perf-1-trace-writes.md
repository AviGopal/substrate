# activity-api trace write path: why inserts take 15–60 s, why 63% are duplicates, and how to reach milliseconds

Read-only investigation, 2026-09-25 07:42–08:05Z, on `substrate-live`. Nothing was restarted, written or edited.
Four SurrealQL requests were sent: `INFO FOR DB`, one batch of five `INFO FOR TABLE`, and two `EXPLAIN` batches (the first failed to parse and did not run).
There was one `journalctl -u activity-api --since -10min` capture (80,494 lines, 07:42:06–07:52:09). The source is `/vessels/activity-api/src`. Line numbers are from the runtime copy.

> **Two restarts during the window, neither caused by this investigation.** `self-recovery-tick` restarted activity-api as UNHEALTHY at **07:51:42** and again at **07:57:45**. It also restarted development-vessel at 07:52:36. All per-request statistics below come from the pre-restart process (pid 731174, 07:42:06–07:51:42, **9.6 min**).

## TL;DR

| | |
|---|---|
| **Root cause (measured)** | This is **queueing, not per-statement cost**. activity-api had on average **~498 HTTP requests in flight** (300,174 request-seconds over 603 s). Every root DB call goes through one process-wide semaphore of **16 slots** (`db/surreal.ts:88`). A trace POST makes **~8–10 serial awaited DB round trips**, and each one waits in that queue. On a freshly restarted process, the same statements cost **INSERT 89 ms mean, SELECT p50 9–22 ms** (`/metrics/db`). Under load, `insertExecution` alone takes a p50 of 20 s, and the whole POST takes a p50 of **51 s** (p99 159 s). |
| **Duplicates (measured)** | **Every duplicate is a client retry of a first attempt that had already committed.** The emitter (`TranslatingTraceSink`, bundled in every vessel through ias-executor-ts) aborts after **15 s** (`activity-api-trace-sink.ts:317`, `AbortSignal.timeout(15000)`) and retries up to 3 times (backoff of 250 ms, then 1 s). The server never sees the abort, so attempt 1 finishes and commits. Attempts 2 and 3 then run the whole pre-insert path and fail on `already exists`. Of the ids seen: **158 were `ok→dup→dup`, 50 were `ok→dup` and 42 were `ok`**. None had a dup before its ok. The median gap between attempt 1 and attempt 2 is **15.3 s**, which is exactly 15 s + 250 ms. |
| **Feedback loop (measured plus inferred)** | Once latency passes 15 s, each trace becomes about 2.2–3 POSTs, and ~63% of ingest DB work goes to wasted duplicates. That keeps latency above 15 s: a **metastable state**. `/health` shares the same semaphore, so it times out and self-recovery restarts activity-api. The restart kills ~500 in-flight requests, and they all retry. |
| **Onset lead (inferred, strong correlation)** | goal-host `walk(/resolve)` walks **started at 06:40** (0 in 05:30–06:40). They then grew per 10 min: 138 → 226 → 927 → 1,239 → … → 2,798 (07:40–07:50). This coincides with the learning-loop selftest dispatch at **06:38:50**, and that goal now recurs through goal-host, including **goal-host resolving `goal_execution` by calling itself (:8210)**. Details are in §7. |
| **Top 3 fixes** | (1) **Validate, then durably enqueue, then return 202**, with a batched writer: p50 ~1–3 ms, p99 <20 ms. (2) **An idempotent fast path**: an in-flight set plus an `execution:⟨id⟩` point read before any work, with non-idempotent side effects moved after the authoritative insert. This removes ~63% of ingest DB work. (3) **Move the learning tail (cts/vpm/activity_template/Redis) into the existing `posterior-aggregator`**, and fix its two full-table scans. The request path shrinks to one INSERT. Only (1) reaches single-digit ms by construction. (2) and (3) are what let the drain keep up. |

---

## 1. The exact write path for one trace (`POST /v2/activities/execution-traces`, `routes/execution-traces.ts:2357–4109`)

Everything below runs **serially in one async handler. There is no transaction.** Each statement is its own auto-committed SurrealDB request. "Awaited" means it is on the request's critical path. "Detached" means `void …` or `.catch()`, which is not awaited but **still consumes the same 16 semaphore slots** and the same DB.

| # | Statement | Where | Awaited? | Notes |
|---|---|---|---|---|
| 1 | `denormalizeCompositionChain`: `SELECT execution_id, composition_chain FROM v_paradigm_execution_traces …` | :2425, :1621 | **awaited** (only when there is a parent and no client chain) | `v_paradigm_execution_traces` **does not exist** (it is absent from `INFO FOR DB`), so the round trip is wasted |
| 2 | Shape validation: `SELECT output_shapes FROM activity_template WHERE record::id(id)=… OR …` | :2548 | **awaited** (success with output impulses) | `activity_template` has 0 rows |
| 3 | `resolveLearningTrack`: `SELECT learning_track FROM activity WHERE id=$id` (+ `activity_template` fallback) | :2623, `lib/learning-track.ts:52` | **awaited**, 60 s TTL cache | EXPLAIN: `Iterate Index idx_activity_id` |
| 4 | Prior-repair-signature CTS read-modify-write (`LET $existing … IF … UPDATE … ELSE CREATE`) | :2700 | **awaited** (when `metadata.prior_repair_signature`) | **Runs before the duplicate check and is not idempotent**, so a retried trace increments α/β again |
| 5 | AET `INSERT INTO activity_execution_traces` | :2835 | awaited only when `DUAL_WRITE_ENABLED`, which is **unset, so off** | — |
| 6 | `INSERT INTO trace_digest` | :2877 → :594 | detached | Unique `idx_trace_digest_execution_id`. **481 dup failures in 9.6 min** |
| 7 | `INSERT INTO execution_trace_content` (full task array) | :2880 → :632 | detached | Unique `idx_etc_execution_id`. **456 dup failures**. The catch at :655 swallows them, but `surreal.ts:283` has already logged them at ERROR **with the full params** |
| 8 | `incrementExemplarBurstCounter` → later `INSERT INTO execution_exemplar` | :2884 | detached | 315 dup failures |
| 9 | `incrementTraceStoreCounter` (`UPSERT trace_store_counters … +1`) | :2887, `lib/trace-store-counters.ts:42` | detached | Not idempotent, so it counts retries. `row_count` read 152,674 against cap 150,000 |
| 10 | `backfillChildCompositionChains`: `SELECT VALUE id FROM execution WHERE parent_execution_id=$p LIMIT 1` (+ `UPDATE activity_execution_traces SET composition_chain` + `UPDATE execution …`) | :2896, :1696 | detached | Goes through **`queryWithAuth`** (see §2c). 643 probes and 142 AET UPDATEs in the window |
| 11 | `deriveCompositionEdgeFromParent`: `SELECT activity_id FROM type::thing('execution',$pid)` + edge write | :2910, :1793 | detached | `queryWithAuth`, 418 in the window |
| 12 | WebSocket `task.*` / `impulse.resolved` broadcasts | :2931–3110 | sync | Repeated on every retry |
| 13 | **`insertExecution`**: `resolveLearningTrack` (cached) + **`INSERT INTO execution {…}`** | :3234 → `db/paradigm.ts:333–503` | **awaited, authoritative** | Maintains 14 indexes plus the `v_shape_conditioned_score` group row. A duplicate throws `Database record execution:⟨…⟩ already exists`, and the outer catch (:4081–4097) maps that to **200 `{duplicate:true}`** |
| 14 | `SELECT output_shapes FROM activity_template WHERE record::id(id)=$a OR name=$a` | :3270 | **awaited** | 0-row table |
| 15 | `UPDATE activity_template SET total_executions … WHERE (record::id(id)=… OR name=…) AND (org_id=… OR …)` once per candidate id | :3404 | **awaited**, `queryWithAuth` when there is a JWT | **Dead write**: 0 rows. "returned no results" appears 257× in the window |
| 16 | Redis `del activity:template:<id>` | :3433 | awaited | Only when #15 matched, so effectively never |
| 17 | `applyOutcomeToPosteriors` (vpm α/β through the coalescer, the v1 cts cell, chain credit) | :3504 | detached | Uses `lib/posterior-aggregator.ts` when `POSTERIOR_COALESCE` is on (the default) |
| 18 | `checkAndRetireByPosterior` / `updateSuccessorFeatures` | :3558, :3598 | detached | — |
| 19 | **Context-bucket CTS read-modify-write** (`LET $existing = SELECT … WHERE (account_id=$a OR (account_id IS NONE AND org_id=$o)) AND template_id AND context_bucket; IF … UPDATE … WHERE <same> ELSE CREATE`) | :3704 or re-derive :3787 | **awaited**, `queryWithAuth` when there is a JWT | **EXPLAIN: `Iterate Table context_thompson_scores`**. The OR defeats `idx_ctx_ts_versioned`. The UPDATE repeats the same scan inside a write transaction. **76 `re-derive update failed` (read/write conflict) in the window** |
| 20 | **vpm find**: `SELECT id FROM variant_performance_metrics WHERE variant_id=$v AND (account_id IS $a OR (…))` + `UPDATE $id …` or `INSERT` | :3926, :3938 | **awaited**, once per candidate id | **EXPLAIN: `Iterate Table variant_performance_metrics`**, even though the row id is a deterministic slug (`variantMetricsRecordId`) that could be read directly |
| 21 | `updateShapeActivityScores` | :3977 | detached | — |
| 22 | `execution_completed` broadcast, then `return c.json(...)` | :4029, :4074 | — | — |

**Views triggered.** Only one view reads a trace table: `v_shape_conditioned_score AS SELECT … count(), math::mean(duration_ms), math::mean(cost_usd), time::max(executed_at), time::min(executed_at) FROM execution WHERE input_impulse_shapes != NONE … GROUP BY activity_id, org_id, shape_signature`. On INSERT this is an incremental read-modify-write of one group row, because min and max can be updated by comparison. The expensive full-group recompute happens only when an extremum is **deleted** (TRACE-STORE-GROWTH §3), so it is not the insert cost. `v_activity_score` **does not exist** (264 SELECTs against it in the window). No view reads `trace_digest` or `execution_trace_content`, and there are no events or live queries on them (`INFO FOR TABLE`).

**Critical path, first attempt:** #1–#4, #13, #14–#16, #19, #20. That is ~8–10 awaited round trips, each queued at the semaphore. **Critical path, duplicate attempt:** #1–#4 plus the failing #13, with the detached #6–#12 fired as well.

## 2. Where the time goes

### 2a. Measured timings

| measurement | n | p50 | p90 | p99 | max |
|---|---|---|---|---|---|
| POST `/execution-traces`, whole request (Hono `-->` line) | 667 | **51 s** | 120 s | 159 s | 181 s |
| `insertExecution` ok (`latency_ms`) | 250 | 20.0 s | 39.7 s | 59.2 s | 60.2 s |
| `insertExecution` duplicate (`latency_ms`) | 423 | 27.7 s | 56.8 s | 61.5 s | 80.4 s |
| per id, "Execution trace stored" log → insert outcome | 247 | 18.5 s | 34.2 s | — | 60.2 s |
| per id, insert outcome → "Variant performance metrics updated" (the awaited tail, #14–#20) | 210 | **56.5 s** | 117 s | — | 152.6 s |
| per id, attempt 1 → attempt 2 start | 214 | **15.3 s** | 52.2 s | — | 224.5 s |
| GET `/execution-traces/:id` (read-back) | 624 | 65 s | 102 s | 205 s | 215 s |
| GET `/health` | 1,604 | 0 s (10 s cache) | 25 s | **60 s** | 61 s |
| **Fresh process** `/metrics/db` (8–76 s after restart, 10 in flight) | 229–3,923 queries | **9.4–22.5 ms** | p95 96–925 ms | 161 ms–2.8 s | — |
| fresh process, per-op mean | — | INSERT **88.8 ms** (n=300), UPDATE 70–106 ms, SELECT 22–353 ms, UPSERT 351 ms | | | |
| `INFO FOR TABLE` metadata calls sent straight to :8000, bypassing activity-api | — | execution 196 ms, cts 181 ms, vpm **649 ms** | | | |

### 2b. The split (inferred from the table above)

- **Queueing and contention: ~95%+ of wall time.** An INSERT that costs ~90 ms on a fresh process takes 20 s under load, and the awaited tail of ~5 statements takes 56 s. By Little's law, ~498 concurrent requests × several DB calls each, fed through 16 slots, gives waits of tens of seconds. The two queues are:
  1. **the in-process `QuerySemaphore(16)`**, shared by ingest, `/health`, discover-by-shapes, recommend, FTS search, the llm-router, retention and the read-backs;
  2. **SurrealDB itself**, at loadavg 29–31 on 16 cores. Even an `INFO FOR TABLE` takes 0.2–0.65 s, so the DB is also saturated, although the in-process queue dominates.
- **Index maintenance: ~tens of ms per insert, inferred.** `execution` has **14 indexes** (§4, D6); `trace_digest` has 5 and `execution_trace_content` has 2. This is bounded by the 89 ms fresh-process INSERT mean, which also includes the view group update and blob I/O.
- **View recompute: small on insert, inferred.** `v_shape_conditioned_score` is one group-row read-modify-write per insert. It is a **conflict hotspot** for hot groups (validator-dispatch: 748 rewrites/h in TRACE-STORE-GROWTH §1c) but not a scan.
- **Blob I/O: small on the insert path, inferred.** An `execution` row is ~786 B median (inline in SSTs). The heavy content goes to `execution_trace_content` (detached). `walk-satisfier-failed-*` rows can reach 67 KB and go to blobs.
- **Full-table scans on the request path: measured with EXPLAIN.** Each first attempt scans `context_thompson_scores` twice (the LET and then the UPDATE, inside a write transaction, so the whole table sits in the optimistic read set and conflicts are likely) and `variant_performance_metrics` once. Row counts were not measured (count() is forbidden here).

### 2c. Amplifiers inside activity-api (measured)

- **`queryWithAuth` bypasses admission control.** `DB_POOL_ENABLED` is unset, so the legacy path (`db/surreal.ts` `queryWithAuth` → `createAuthenticatedClient`) opens a **new SurrealDB client, signs in with a JWT, runs one query and closes it, on every call**, with no semaphore. There were **3,406 calls in 9.6 min**: parent probe 643, v_shape_conditioned_score 522, `type::thing('execution',…)` 418, FTS 338+338, activity_template UPDATE 244, cts LET 164, AET chain UPDATE 142.
- **Log volume.** Each `Executing authenticated query` INFO line carries the full params (~11 KB): **37.1 MB of the 52.3 MB logged in 9.6 min**. The ERROR lines for duplicate `execution` and `execution_trace_content` inserts add another 3.6 MB, and they also carry the full task arrays. All of this is serialized on the Bun event loop.
- **Landmine: the pooled path is broken.** When `DB_POOL_ENABLED=true`, `queryWithAuth` runs a hard-coded `SELECT id, name, … FROM template` and **ignores `sql`**. Turning the pool on as a performance fix would silently break every authenticated query.
- **Read-back load exceeds write load.** GETs of `/execution-traces/:id` used 43,464 request-seconds against 41,862 for POSTs. A single sampled trace (`walk-satisfier-1-1790321911767`) was fetched 5 times after its POST. Each GET tries AET first and then falls back to `execution` (two queries), even though AET is decommissioned.

## 3. The retry loop

**Who retries: the client.** activity-api does not retry at the HTTP level. Its only internal retries are the 4× conflict retry in `surreal.ts:241` and the anonymous-auth reconnect.

- `ias-executor-ts/src/adapters/activity-api-trace-sink.ts`, `TranslatingTraceSink`. This is used by goal-host (`goal-host-vessel/src/index.ts:378`, `:6287` `satisfierTraceSink`, and through `ActivityApiAdapter`) and by development-vessel.
  - `postOnce` uses `signal: AbortSignal.timeout(15000)` (:317). A 5xx or a transport error, including the abort, counts as `retryable`.
  - `postWithRetry` makes **3 attempts** with backoffs `[250, 1000]` ms.
  - After that it writes a durable spool file (`/workspace/trace-spool`). A replay runs every **60 s**, taking 25 files per drain, one `postOnce` each. **The spool currently holds 11,716 files**, the oldest from ~2026-08-17. That backlog never drains and is a fourth source of attempts.
- **Why the first attempt counts as failed although it committed.** The client gives up at 15 s, but the server has no cancellation: Hono and Bun keep running the handler. Attempt 1 commits the `execution` row at ~18–20 s p50, and its tail runs for another ~56 s. The client has already recorded a network error and retried. Attempts 2 and 3 arrive while attempt 1 is still running, so the row sometimes does not exist yet and the pre-insert work runs again in full.
- **Evidence.** The per-id attempt patterns in the window were: `ok→dup→dup` 158, `ok→dup` 50, `ok` alone 42, `dup` only 39, `dup→dup` 9. The last two are ids whose first attempt fell before 07:42. **There is no id where a duplicate precedes the ok.** The median attempt spacing is 15.3 s. The duplicate ceiling for 3 attempts is 2/3 = 67%; observed was **63%** (423/673).
- **Wasted work, 9.6 min, measured.**
  - 423 duplicate attempts × (#1–#4 + failing `execution` INSERT + failing `trace_digest` INSERT + failing `execution_trace_content` INSERT + burst counter → failing `execution_exemplar` INSERT + `trace_store_counters` +1 + backfill probe through a fresh-connection `queryWithAuth` + the composition-edge lookup) ≈ **7–10 DB statements each, so ~3,000–4,000 wasted statements**, ~5–7 per second.
  - Duplicates held request slots for **~11,700 request-seconds** (423 × 27.7 s p50), **~28% of all POST request-seconds**.
  - Distinct new traces ran at ~26/min, the same as the ~31/min of 06:50 (154 per 5 min, per the coordinator). **Arrival did not grow much. The POST count grew through retries** (~70/min).
- **Correctness side effects of retries (measured from code).** Before the duplicate is detected, a retry has already:
  - applied the prior-repair CTS α/β increment again (#4);
  - incremented `trace_store_counters` and the exemplar burst counter again;
  - re-broadcast every `task.*` WebSocket event;
  - possibly re-derived a composition edge.

  The trace store's `row_count` (152,674 against cap 150,000) is therefore inflated by retries between reconciles, which pushes retention harder.

**The loop, labelled.**

1. Slow awaited statements, caused by queueing (measured).
2. The POST passes the client's 15 s timeout (measured: p50 51 s).
3. The client aborts and retries. The server keeps working on both attempts (measured).
4. Each retry adds ~7–10 wasted statements and occupies a request slot for ~28 s (measured).
5. The semaphore and the DB queue grow, so step 1 gets worse (inferred).
6. `/health` waits on the same semaphore and hits its 60 s p99 (measured). self-recovery restarts activity-api (07:51:42 and 07:57:45, measured). ~500 in-flight requests are cut, and every one becomes a retryable transport error at the client (inferred).
7. Traces that fail 3 times go to the spool (11,716 files) and are replayed every minute, forever (measured).

## 4. Design to reach p50 < 10 ms and p99 < 50 ms, ranked by expected effect

The per-statement floor is ~9 ms for a SELECT and ~89 ms for an INSERT, measured on a fresh process. **A synchronous insert with 14 indexes cannot reach a single-digit-ms p50.** Only acknowledging before the insert can. Every other item below reduces DB load, so the background writer keeps up and p99 stays bounded.

| rank | change | expected POST p50 / p99 | risk | files | falsifier |
|---|---|---|---|---|---|
| **D1** | **Validate, then durably enqueue, then return 202 `{execution_id, accepted:true}`.** Push the raw body to a durable queue: a Redis Stream (`XADD`; Redis is already a dependency), or a local append-only log if Redis persistence (AOF) is not guaranteed. A single background writer drains in batches of up to 50 rows or 100 ms: one `INSERT INTO execution $rows` per batch, then the digest and content rows as batched inserts, then the derived writes (D3). An in-memory `pending` map serves `GET /execution-traces/:id` until the flush. | **~1–3 ms / <20 ms** (JSON parse + XADD; event-loop lag is the residual risk) | Medium. (a) Read-after-write: the reach-gate and selftest GET immediately, so GET must consult `pending`. (b) Durability depends on the queue's persistence. (c) Queue lag becomes the new SLO. Drain capacity is ≫ arrival: ~26 new traces/min against ≥10/s serial insert capacity, more with batching. | `routes/execution-traces.ts` (split into `validateAndEnqueue` and `ingestTraceBatch`), new `services/trace-ingest-queue.ts`, `index.ts` (start the worker, flush on SIGTERM like `posterior-aggregator`). Client: none, since the sink already treats any 2xx as ok. | Under the same load, the `--> POST /v2/activities/execution-traces` p50 is <10 ms and p99 <50 ms. **A new `/metrics/ingest` shows the oldest pending age staying under 5 s.** If the queue age grows without bound, drain capacity is below arrival and 202 only moved the queue. |
| **D2** | **Idempotent fast path, before any work.** (i) Keep an in-process `inflight: Set<execution_id>` and a recent-accepted LRU. On a hit, return 200/202 `{duplicate:true}` at once; this covers retries that arrive while attempt 1 is still running, which the DB cannot see yet. (ii) Otherwise do a point read of `type::thing('execution',$id)`, which is O(1) on the record key. (iii) Move every non-idempotent side effect (repair-sig CTS #4, counters #8–#9, broadcasts #12, digest/content #6–#7) **after** the authoritative insert succeeds. Prefer the existence probe to UPSERT: UPSERT would redo index and view maintenance on every duplicate. Only rely on `INSERT IGNORE` after verifying its semantics on 2.3.3. | Duplicate requests go from p50 27.7 s to **<5 ms**. The cut in ingest DB work (~63% of POSTs) takes first-attempt p50 from 51 s to an estimated ~15–25 s even without D1. | Low. The row already exists, so returning success is correct (the outer catch already does this). Risk: an attempt that dies mid-flight after being marked in-flight; clear the set in `finally`. | `routes/execution-traces.ts` (head of the handler and reordering :2700–:2931 to after :3234) | The count of `Failed to insert execution into new schema` falls to **~0 per 10 min** (was 423). `idx_trace_digest_execution_id already contains` and `idx_etc_execution_id` fall to ~0 (were 481 and 456). `trace_store_counters.row_count` tracks `count()` from the reconciler without drift. |
| **D3** | **Move the learning tail off the request path and coalesce it** (law 3: reuse `lib/posterior-aggregator.ts`, which already coalesces vpm α/β every 250 ms). Enqueue additive deltas for the vpm counters, the cts cells and the successor features. **Replace the scans with record-id access**: vpm is `UPDATE type::thing('variant_performance_metrics', $slug)`, since the slug is already deterministic (`variantMetricsRecordId`); give cts a deterministic id `[org, template, sig_version, bucket]` with `UPSERT … SET alpha += Σδ`. **Delete #14–#16**: the `activity_template` table has 0 rows, so the SELECT/UPDATE/Redis del are dead. Delete #1's query against the nonexistent `v_paradigm_execution_traces`. | Alone, the request path drops from ~8–10 awaited round trips to ~2–3, giving p50 ≈ one queued INSERT, **~0.1–0.5 s at normal load**. Combined with D1, the writer's per-trace cost falls ~5× and conflicts disappear. | Low to medium. Coalescing delays posterior visibility by ≤250 ms. The cts id migration must preserve existing cells; a one-time re-key uses the existing composite index. | `routes/execution-traces.ts` :3253–:3960, `lib/posterior-aggregator.ts` (add `enqueueCtsDelta` and `enqueueVpmCounters`), `lib/posterior-update.ts` :688/:1224 (same OR-scan pattern) | EXPLAIN on the new cts and vpm statements shows record access instead of `Iterate Table`. `read or write conflict` / `re-derive update failed` fall to 0 (were 76 per 9.6 min). The time between the per-id insert and the response shrinks from 56 s to <1 s. |
| **D4** | **Stop using `queryWithAuth` on the write path.** Use root for #10, #11, #15 and #19, as the handler already argues at :2821 for execution, digest and content (HTTP-layer auth is enforced). Drop `Executing authenticated query` to debug and stop logging `params`. **Fix or remove the broken pooled branch** (hard-coded SQL). | Removes ~1,600 fresh connect+signin cycles per 10 min that bypass admission, and ~70% of log bytes. Estimated p99 improvement of several seconds under load. | Low. Tenant PERMISSIONS stop being evaluated for these writes, the same trade the authoritative insert already made. | `routes/execution-traces.ts`, `db/surreal.ts` (`queryWithAuth` log level, pooled branch) | The `Executing authenticated query` count on the POST path falls to 0. Journal bytes per 10 min drop from 52 MB to under ~15 MB. The count of activity-api TCP connections to :8000 (in `/proc/net/tcp`) stays flat under load. |
| **D5** | **Client: bounded retries with an idempotency key, so a server that is slow is not treated as a failure.** Send an `Idempotency-Key: <execution_id>` header. With D1, keep the 15 s timeout. Without D1, set the timeout above the server p99, or better, add exponential backoff with jitter and a circuit breaker (stop retrying while more than N attempts are timing out). Cap the spool with a TTL, age out entries older than 7 days to a dead-letter log, and replay at concurrency 1 with backoff. | Removes duplicates at the source even when the server is slow. Posts per distinct id go from ~2.24 to ~1.0. | Low for the code change. It needs a rebuild and redeploy of every vessel that bundles ias-executor-ts (goal-host, development-vessel). | `ias-executor-ts/src/adapters/activity-api-trace-sink.ts` (:317, :334–:345, the spool methods) | The attempt-1 → attempt-2 spacing distribution loses its 15.3 s mode. POSTs per 10 min divided by distinct `execution_id`s is ≈1.0. `/workspace/trace-spool` stays under ~100 files. |
| **D6** | **Slim the indexes on `execution`**, after confirming readers from query logs. `idx_execution_id ON id UNIQUE` duplicates the record key. A static multiline grep of `FROM execution … WHERE <field>` across `/vessels/*/src` found **0 filter sites** for `resolver_tier`, `vessel_id`, `vessel_version` and `composition_chain` (an **array index, one entry per element**), and 1 for `state_signature` (a field `insertExecution` never writes; it writes `signature`). `account_id` filters come through the `accountIdScopedWhere()` helper, so keep that index. | DB-side INSERT cost drops by an estimated ~20–40% (from ~89 ms). Small effect on request latency once D1–D3 land. | Medium. A grep is a lower bound; a hidden reader would turn into a full scan. Use a `REMOVE INDEX` migration, rolled forward only after a query-log check. | New migration in activity-api | A bench against a copy: mean single-row INSERT time before and after on the same data. There should be no new `Iterate Table` in the EXPLAIN of any reader query. |
| **D7** | **Stop hot-group contention on `v_shape_conditioned_score`.** Replace the foreign-table view with writer-maintained counters through the coalescer: count and sums, with the mean derived in the reader and last_executed_at as a max. This also fixes the extremum-delete cost in TRACE-STORE-GROWTH §3. | Insert: removes one conflicting group read-modify-write per trace (moderate). Retention deletes: large, if §3 holds. | Medium. discover-by-shapes reads it 446/h, so the reader must change. | Migration plus `db/paradigm.ts` (`updateShapeActivityScores`), readers in `routes/activities.ts` | Time an insert into a hot group (validator-dispatch) with and without the view on a copy. Conflict retries in `surreal.ts:241` fall. |
| **D8** | **Loop breakers.** (a) Give `/health` its own connection outside the ingest semaphore, or report `db_last_ok_age` instead of running a query. (b) self-recovery should not restart activity-api on latency alone while it is still making progress; a restart re-injects ~500 retries. (c) GET `/execution-traces/:id` should read `execution:⟨id⟩` directly (AET is decommissioned) plus `pending`. | Prevents the restart-and-retry spiral. Read-back request-seconds (43k per 10 min) fall about 2×. | Low | `index.ts:122`, the self-recovery tick script, the `routes/execution-traces.ts` single-GET | self-recovery has 0 activity-api restarts during an overload episode. GET `/:id` p50 is <50 ms. |

**Batching** belongs inside D1: the writer's `INSERT INTO execution [$r1…$rN]` runs as one statement and one commit. Without D1, batching across HTTP requests would need a micro-batcher that holds responses, which is D1 with extra steps.

**Recommended order.** Do D2 and D4 first: pure code, low risk, and they break the metastable loop. Then D3 and D8. Then D1 for the ms-level SLO. D5 ships with the next ias-executor-ts release. D6 and D7 go with the trace-store maintenance window.

## 5. Could not measure

- The split of each queued statement's wait between the **in-process semaphore** and **SurrealDB's internal queue**. `/metrics/db` latency includes the semaphore wait, and there is no per-query timing inside SurrealDB (no query log at `info`).
- `/metrics/db` under load: activity-api was restarted twice by self-recovery before a loaded sample could be taken, so only fresh-process samples exist (8 s and 76 s uptime).
- Row counts of `context_thompson_scores` and `variant_performance_metrics`, so the cost of each full scan. EXPLAIN confirms `Iterate Table`; count() was off-limits.
- The DB-side cost split (indexes, view, blob) of one INSERT. It needs a write, so it should be benched on a copy (D6/D7 falsifiers).
- Whether the index-free fields have readers outside `/vessels/*/src`: static grep only.
- Redis persistence mode, which determines whether D1 can use Redis Streams as the durable queue.

## 6. Addendum for the coordinator: who posts, what changed, the loop

**(a) Who posts the traces that grew.** All trace POSTs come from **`TranslatingTraceSink`** in ias-executor-ts, bundled into goal-host (`index.ts:378`, `:6287`, `ActivityApiAdapter`) and development-vessel. Activity mix of insert outcomes in 07:42–07:51 (including duplicates):

| activity | outcomes |
|---|---|
| validator-dispatch | 89 |
| slot-binding | 22 |
| satisfier:executionTraceList | 22 |
| satisfier:goal_verification_label_write | 18 |
| universal-tool-fallback | 14 |
| auth_resolve_v1 | 14 |
| learned-composed-cap-report… | 9 |

Id prefixes: `exec_*` 429, `walk-satisfier-*` 190, `universal-tool-*` 40.

**validator-dispatch is a goal-host lifecycle subscriber.** It fires on every `task.completed` (`goal-host-vessel/src/index.ts:14025–14042`, which documents that the recursive cascade is **unbounded**). `GOAL_HOST_DISABLE_SUBSCRIBERS` is **unset** in goal-host's environment, so the cascade is live. Its trace volume scales with the number of tasks goal-host executes.

**(b) What changed at ~06:40–07:00.**
- Commits in `/workspace/git/vessels/*` between 06:20 and 07:15, **all in development-vessel**: 4d5d563 06:22, 1e18e09 06:25, 064cf02 06:39 (`vessel-mitosis-cutover.ts`, 1 line), 0ac156a 06:46 (`trace-store-health-observer.ts`: the slow-query remedy now routes to `development-vessel gap_to_feature` instead of a phantom template, so **the slow-query detector now dispatches real work**), 79562c7 06:48.
- **79562c7 is inert on this host.** `ownedVessels()` reads `VESSELS_CLONE_ROOT` (unset), which defaults to `/workspace/git/vessels`, which has **19 `.git` dirs**. `ownedSet.size > 0` therefore always holds, and the guard behaves exactly as before.
- Restarts: development-vessel at 06:49:16. goal-host was **not restarted** (pid 166119 from before 06:40 through 08:00).
- **Strongest lead (measured correlation, causation inferred).** Counts of goal-host `walk(/resolve)` log lines per window:

  | window | `walk(/resolve)` lines |
  |---|---|
  | 05:30–06:00 | 0 |
  | 06:00–06:30 | 0 |
  | 06:30–06:40 | 0 |
  | **06:40–06:50** | **138** (first at 06:40:09) |
  | 06:50–07:00 | 226 |
  | 07:00–07:10 | 927 |
  | 07:10–07:20 | 1,239 |
  | 07:40–07:50 | 2,798 |

  `walk(/run-goal)` lines stayed at 49–162 per 10 min. Over the same period, lines mentioning the selftest goal went 27 → 13 → 59 → 94 → 241 per 10 min, and `recordGoalPath … reached=false` for it went 4, 3, 14, 27, 20, 59, 55, then **221 in 07:50–08:05**.

  **learning-loop-selftest.timer** (6 h cadence) fired at **06:38:50** and POSTed `learning-loop-selftest: exercise the execution→learning chain with a known-answer gate probe` to goal-host `/run-goal` (`scripts/substrate/learning-loop-selftest-tick.ts:276`). The oneshot service exited at 06:39:35 with RED. The walk it started (dispatch f844c371) retried each executor up to 6–7 self-correction attempts, 2–5 s apart, ended `reached=false`, and **the goal kept being re-walked after the dispatch id disappeared**.

  In the current walks, goal-host resolves the target shape `goal_execution` by **calling itself**: `vessel-resolver candidate found for shape goal_execution via http://127.0.0.1:8210 — injecting vesselResolve step`. That line appeared 0 times before 06:50, then 1, 10, 24 … 26 per 10 min. This is a self-dispatch recursion. Each nested walk runs satisfiers, which produce `walk-satisfier-*` / `universal-tool-fallback-*` traces, and each task triggers validator-dispatch.

  Nothing I read backs off on `reached=false`. The only bound is the per-executor self-correction attempt cap. This matches the coordinator's FTS finding: the same goal string every ~2.7 s.

  **Not established:** which caller re-issues the goal to goal-host `/resolve` after the original dispatch ended (the goal-host log has no request-line logging). It is also unexplained why earlier 6-hourly selftest runs (00:38, 18:38) did not tip over; the likely factors are lower background load and the 15 s client timeout not being crossed.

**(c) Duplicates come from the caller's retry on timeout.** Yes, this is measured (§3). The client timeout is 15 s (`activity-api-trace-sink.ts:317`); it makes 3 attempts with 250 ms and 1 s backoff, then spools and replays every 60 s. **The spool holds 11,716 files.** The server has no timeout or cancellation, and the handler always runs to completion. Separately, the selftest tick uses a 120 s timeout on `/run-goal`.

**(d) The feedback loop.** Slow insert (queueing) → the client's 15 s abort → the retry re-runs ~7–10 statements while attempt 1 is still running → a deeper queue → `/health` times out → self-recovery restarts activity-api and cuts ~500 in-flight requests → more retries → spool. Arrival of new traces is ~26/min, about the same as before the storm. POST volume ~2.2–3× that is retry amplification, on top of whatever extra walks the selftest recursion adds.
