# activity-api latency to milliseconds: plan (2026-09-25)

Five read-only investigations (`perf-1` … `perf-5` in this folder), plus the
trace-store report (`TRACE-STORE-GROWTH.md`). Measured under the 07:00–08:00Z
overload (host load ~31/16, surrealdb up to ~11.6 cores); absolute numbers are
inflated by contention, the ranking is not.

## What is actually happening

1. **Queueing, not work.** On a freshly restarted process an execution INSERT
   takes ~89 ms and a SELECT p50 9–22 ms. Under load ~500 requests share one
   16-slot DB limiter (`db/surreal.ts:88`); each trace runs 8–10 serial DB
   calls, so POST /execution-traces is p50 51 s / p99 159 s.
2. **Retries turn slowness into a storm.** The shared trace sink
   (`ias-executor-ts/src/adapters/activity-api-trace-sink.ts:317`, bundled into
   every vessel) aborts at 15 s and retries 3×; the server never sees the abort,
   so the first attempt commits and the retries fail as duplicates. 63% of
   inserts are duplicates; ~2.5 deliveries per trace; 11,716 files in the retry
   spool. New-trace arrival is flat (~26/min): the extra volume is retries.
3. **Every read pulls whole 20 KB rows.** Selection runs three tiers per
   `/recommend`, each a near-full scan of `activity` via `SELECT *` (two
   384-float embeddings per row, from a store that is ~89% blob garbage):
   dense scan avg 106 s (no vector index, no timeout), FTS 99% timeout (tenant
   `OR` filter defeats the index), Tier 1 ~16.5 MB of JSON per call.
4. **The learning read is broken, not just slow.** The legacy score query
   (`db/paradigm.ts:746`) filters `variant_id IN $activity_ids` with
   `activity:⟨…⟩` ids while rows store bare names, and `v_activity_score`
   does not exist: 242/242 reads returned 0 rows, so that selection path runs
   on the default prior instead of posteriors such as α 492 / β 901.
5. **Dead and self-inflicted writes.** A 30-min `REBUILD INDEX` that SurrealDB
   2.3.3 does not need (F-V45/46 was a 3.0.0 bug), a classifier that rewrites
   up to 2,000 activity rows on every start and every 6 h, an UPDATE on an empty
   `activity_template`, two full-table scans on the ingest path, and ~50% of
   `context_thompson_scores` writes lost to conflicts.
6. **Onset (correlation).** goal-host `/resolve` walks began 06:40 after a
   learning-loop selftest dispatch at 06:38:50 that repeats with reached=false
   and no backoff; goal-host resolves `goal_execution` by calling itself.
   Commit 79562c7 is inert on this host.

## Ranked fixes (each is a filed gap with a falsifier)

| # | Fix | Where | Target | Window |
|---|---|---|---|---|
| 1 | Duplicate check first; non-idempotent effects after the insert | activity-api `routes/execution-traces.ts` | duplicates answered < 5 ms; −63% ingest DB work | post-run-10 |
| 2 | Sender: timeout ≥ server p99 or 202-ack, idempotency key, backoff; drain spool gradually | ias-executor-ts trace sink (all vessels) | 0 duplicate deliveries | after run 12 (all vessels rebuild) |
| 3 | Learning writes off the request path, by record id, no scans; delete dead writes | activity-api `execution-traces.ts:3704, :3926`, `lib/posterior-aggregator.ts` | request path = 1 INSERT (0.1–0.5 s, then ms with #4) | post-run-10 |
| 4 | Accept + durable queue + 202; batch writer | activity-api | POST p50 1–3 ms, p99 < 20 ms | after run 12 |
| 5 | Dense step scores Tier 1 rows in process + query-embedding LRU; `OMIT` embeddings in Tier 1/FTS | activity-api `db/paradigm.ts:1585`, `tiered-fallback.ts:107` | dense < 5 ms | post-run-10 |
| 6 | FTS circuit breaker; ids-only query with tenant filter outside; delete periodic rebuild | activity-api `queryActivitiesByFTS`, `index.ts` | 0 ms while open; low ms when fixed | post-run-10 |
| 7 | Score-read id normalization; drop absent-view query; in-process score cache | activity-api `db/paradigm.ts:746, :1135` | < 1 ms; posteriors actually read | **alone**, after run 12 (changes selection) |
| 8 | Pooled `queryWithAuth` ignores its SQL (`db/surreal.ts:384`); fix, then enable pool | activity-api | −0.08–0.36 s/query | after run 12 |
| 9 | SQL logging to debug; slow-query log > 100 ms by statement hash | activity-api `db/surreal.ts:378/395` | −37 MB / 10 min of logs | post-run-10 |
| 10 | Classifier writes `last_classified_at` outside `activity` / only on change | activity-api | no whole-table rewrites | after run 12 |
| 11 | Selftest re-dispatch without backoff; goal-host self-dispatch | goal-host | loop stops | post-run-10 |

Already filed today and still valid: FTS rebuild (now: delete, not
"rebuild on invalidation"), `cluster_shadow_decision` expiry, dead
`activity_template` UPDATE, `context_thompson_scores` conflicts, store-health
detector, gap-store cross-process race.

**Do not enable `DB_POOL_ENABLED` before #8 lands**: every JWT-scoped query
would return template rows.

## Order

Post-run-10 window (activity-api/goal-host allowed): stopgap drop-in, then
#1, #6, #5, #3, #9, #11: the fixes that remove the most wasted work without
changing what selection picks. Measure the same breakdown after each (law 12).
After run 12: #2 and #4 (cross-vessel), #7 alone (changes selection),
#8, #10, and the trace-store compaction.
