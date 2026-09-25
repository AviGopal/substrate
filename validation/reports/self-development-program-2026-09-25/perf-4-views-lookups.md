# perf-4 — activity-api score reads and hot lookups: why they are slow, and how each reaches single-digit ms

Scope: read-only. Log window: `journalctl -u activity-api --since -10min`, captured once at about 07:50Z
(81,580 lines, 07:40:51 to 07:50:52Z), plus one goal-host sink-log grep over the same window. Live DB: 5 statements
(INFO FOR DB, one EXPLAIN that failed to parse and executed nothing, 3 EXPLAINs). No writes. No restarts.
Note: activity-api restarted at 07:57:47Z. Something else did that, after the log window.

Labels: **[M]** = measured here. **[S]** = read from source. **[I]** = inferred.

---

## 0. Headline

1. **All four score reads return zero rows, by construction.** [M] In the window: 242/242 "fetched from legacy table" had `count:0`, and every
   `/recommend` logged `scoreMethod:"global"` with `count:0`. Two separate reasons:
   - `v_activity_score` **does not exist in the database** [M, INFO FOR DB]. Only one live view aggregates `execution`,
     and it is `v_shape_conditioned_score`. In SurrealDB 2.x (non-strict), a SELECT on a missing table returns `[]` without an error,
     so the path always falls through to the legacy branch.
   - **Id-form mismatch.** The recommend path binds prefixed ids (`activity:⟨…⟩`) [M, logged params]. Two queries receive them
     un-normalized: the `v_shape_conditioned_score` query (`db/paradigm.ts:1135`) and the legacy
     `variant_performance_metrics` query (`db/paradigm.ts:746`, `params.activity_ids = activityIds`). The stored
     `activity_id` / `variant_id` are bare. [I from 3 logged vpm writes (`auto-bridge-test_report`, `reuse-probe-…`,
     `satisfier:memoryNote_write`) and code comments. The vpm distribution was not queried.]
   - So Thompson gets `Beta(1,1)` for every arm. **16–48 s per recommend buys nothing.** This is a correctness bug first
     and a latency bug second. The fastest fix is to stop running the dead queries and run the right ones.
2. **The slow part is query execution plus transfer, not the connection handshake.** [M] I paired each
   "Executing authenticated query" line with its "…fetched" line (137 unambiguous pairs for shape-match):
   handshake p50 **0.08 s** (p90 0.36 s); query + transfer p50 **4.97 s** (p90 8.68 s). Server-side planning is tiny
   (EXPLAIN 0.5–11 ms). The cost is **rows read and shipped**: a full `Iterate Table` over `activity`, 927–943 rows
   returned `SELECT *`, including 384-d embedding arrays [S], `tasks`, and the schemas and metadata. That runs on a store with
   ~89% blob garbage and a SurrealDB at ~11 cores.
3. **The hot lookups are inflated about 2.6× by a retry storm, and about 5× more by fan-out repetition.** [M]
   908 "Execution trace stored" events in 10 min cover only **347 distinct execution ids**; 252 ids arrived **3×**.
   goal-host's `TranslatingTraceSink` logged **924 client timeouts** in the same window. It uses a 15 s `AbortSignal.timeout`
   and 3 attempts (`ias-executor-ts/src/adapters/activity-api-trace-sink.ts:317,353`). Trace POSTs take 8–115 s [M].
   Every delivery re-fires every detached side effect before the duplicate is detected. This is a positive-feedback loop:
   slow ingest → client timeout → retry → more ingest load.
4. **`v_shape_conditioned_score` costs writes and gives reads nothing.** It has zero useful reads (all return 0, see 1). Its maintenance
   includes `time::min/time::max`, so each INSERT and each composition-chain UPDATE on `execution` triggers group maintenance.
   [Recompute cost ≈ one filtered scan, ~3.6 s, from the background doc. Not re-measured here, see §5.]

A latent landmine blocks the obvious fix for per-query connections: `db/surreal.ts:384`, in the pooled branch of
`queryWithAuth`, runs a **hard-coded `SELECT id, name, description, content, created_at, updated_at FROM template`**
instead of `sql`. Substrate commit `b1cd133` introduced it ("apply route-edit-62ca912f-compose-report via mitosis
cutover", 2026-07-17). It is dormant only because `DB_POOL_ENABLED` is unset (0 "(pooled)" lines [M]). Setting
`DB_POOL_ENABLED=true` would silently return template rows for every authenticated query. **File this as a gap before anyone
enables pooling.**

---

## 1. Per-statement facts

| # | Statement (exact) | Index? (EXPLAIN) | Row width returned | Frequency | Caller |
|---|---|---|---|---|---|
| A | `SELECT * FROM v_activity_score WHERE ((account_id = $account_id) OR (account_id IS NONE AND (org_id = $org_id OR org_id = $plain_org_id))) AND activity_id IN $activity_ids` | n/a: **table absent** [M] | 0 rows | 267 / 10 min | `getActivityScores` `db/paradigm.ts:604`, via `getShapeConditionedScores` fallback `:1202` ← `/recommend` `routes/activities.ts:6282`; also `:6307`, `:4877` |
| B | Legacy: `SELECT variant_id AS activity_id, org_id, total_executions, thompson_alpha AS alpha, … FROM variant_performance_metrics WHERE ((account_id = $account_id) OR (account_id IS NONE AND (org_id = $org_id OR org_id = $org_id_prefix))) AND variant_id IN $activity_ids` (root connection) | **5-way index union** [M]: `idx_variant_performance_metrics_account_id = NULL` ×2, `idx_metrics_org_id` ×2, `idx_variant_performance_variant_id` union. The `account_id = NULL` / org branches cover roughly the whole table (~3.4k rows [I from code comment counts]), so the union fetches most of the table plus 927 point lookups, then filters | 0 rows (id mismatch) | 242 / 10 min, "fetched from legacy table": avg **18.7 s**, p50 14.3 s, p90 32.3 s, max 63.5 s [M] | same as A (`:707-746`) |
| C | `SELECT * FROM v_shape_conditioned_score WHERE (…account/org…) AND activity_id IN $activity_ids AND shape_signature = $signature`, then on miss the subset variant `… shape_signature ALLINSIDE $signature ORDER BY total_executions DESC LIMIT 1` | not EXPLAINed (budget); view has `idx_v_shape_score_signature`, `_activity`, `_org_activity` [S] | 0 rows (prefixed ids vs bare `activity_id`) | 522 / 10 min = 2 per recommend [M] | `getShapeConditionedScores` `db/paradigm.ts:1126,1163` ← `routes/activities.ts:6282` |
| D | `SELECT * FROM activity WHERE (input_shapes = [] OR input_shapes ALLINSIDE $available_shapes) AND (retired = false OR retired IS NONE) ORDER BY ev DESC, created_at DESC LIMIT $admission_limit` (1000) | **`Iterate Table` + `MemoryOrderedLimit`** [M]. `ALLINSIDE` inside an OR is not indexable. `ev` is not a field on `activity` (it is defined on `activity_template`, `goal_execution_paths` and `variant_performance_metrics`, migration 108 [S]), so the sort is effectively `created_at` | **`SELECT *` of 927–943 rows** [M], each with `embedding` (+ name/description embeddings, 384-d [S]), `tasks`, `input_schema`, `output_schema`, `metadata`, `variables` | 354 / 10 min, "Activities fetched with shape matching": avg **6.5 s**, p50 5.8 s, p90 11.0 s [M]. Handshake 0.08 s p50; query + transfer 4.97 s p50 [M] | `queryActivitiesByShapes` `db/paradigm.ts:799-871` ← `activities.get-activities-with-tiered-fallback.ts:85` (tier 1) and `:230` (tier 2, `[]` shapes) ← `/recommend` |
| E | `SELECT VALUE id FROM execution WHERE parent_execution_id = $parent_execution_id LIMIT 1` | **`Iterate Index idx_execution_parent`** [M], 11 ms planning under load | 1 record id | 892 / 10 min [M] = **1 per delivery**; 331 distinct ids → **2.7× repetition from duplicate deliveries** | `backfillChildCompositionChains` `routes/execution-traces.ts:1718` ← detached at ingest `:2896`. Runs via `queryWithAuth` (fresh connection per call). A hit (202 in window) then runs two UPDATEs (AET + `execution`) |
| F | `SELECT activity_id FROM type::thing('execution', $pid) LIMIT 1` | direct record-key fetch (no plan needed) | 1 field | 645 / 10 min [M] over **119 distinct pids (5.4×)**; the top pids were looked up 12× each; **94 / 645 are `walk-*` ids that can never resolve** | `deriveCompositionEdgeFromParent` `routes/execution-traces.ts:1889` (JWT path), called twice when `bareParent !== raw` (`:1905,1909`) ← detached at ingest `:2910` for every body with `parent_execution_id` |

Outcomes of F in the window [M]: `derive_ok` 264, `parent_lookup_miss` 223, `parent_not_persisted` 70. The regex that
classifies a pid as non-persistable (`:1934`) runs **after** the lookup, so the known-miss ids still cost a round trip.

Per goal walk / per trace [M/I]:
- One `/recommend` = D (1–2×, tier 1 then tier 2 when short) + C (2×) + A + B, all serial, plus FTS (`search::score`, 363) and
  a `math::max` ranking query (359). `/recommend` wall time **58–140 s** [M]. Walk steps call `/recommend` about once per step [I].
- One trace ingest = E (1×) + F (0–2×) + trace_digest / execution_trace_content / exemplar inserts, **× ~2.6 deliveries**.

---

## 2. Why E runs ~90/min and F ~65/min

- **Neither is an N+1 inside one request.** Each runs exactly once (F: at most twice) per trace delivery, detached.
- The rate is **deliveries × fan-out**, and both factors are waste:
  1. **Duplicate deliveries (×2.6)** [M]. 347 new executions → 908 deliveries. Client: 15 s timeout × 3 attempts
     (`activity-api-trace-sink.ts:317,353`), with 924 timeouts logged by goal-host. Server: side effects are launched before
     the authoritative insert rejects the duplicate ("Duplicate trace delivery, already stored", 527 [M]).
  2. **Fan-out (F only)**. A parent with k children is looked up k times (and ×2.6 per child delivery). 119 distinct
     parents → 645 lookups. The parent→activity mapping is **immutable** once written.
  3. **Known misses (F)**. 94 lookups were on `walk-satisfier-*` / non-`exec_xxxxxxxx` ids that the code itself classifies as
     never persisted.
- **Both are cacheable.** activity-api is the process that ingests the parent, so at ingest it already holds
  `(execution_id → activity_id)` and "does this id have children". No DB read is needed for the common case.

---

## 3. Write-side cost vs read-side value of the views

- Live views over `execution` [M]: **only `v_shape_conditioned_score`**. `v_activity_score` is absent. The `v_*_by_account`,
  `v_selection_outcomes`, `v_paradigm_impulse_data` and `v_shape_pattern_performance` tables are empty shells
  (`TYPE ANY SCHEMALESS PERMISSIONS NONE`, no `AS SELECT`), so they cost nothing on the write path.
- Write side [I + background]: ~35 new executions/min [M: 347 / 10 min] + ~20 composition-chain `UPDATE execution` /min [M: 202 / 10 min].
  Each touches one `(activity_id, org_id, shape_signature)` group. `time::min/max` (and UPDATE = retract + add) forces group
  maintenance. The background figure is ≈ 3.6 s of filtered `execution` scan per recompute, i.e. up to **minutes of SurrealDB CPU per minute**
  on the hottest table. It also lengthens every ingest transaction, and so the retry storm.
- Read side [M]: **zero useful rows** (id mismatch). Even after fixing ids, a read is ~250 group rows per org at most.
- **Verdict**: an app-maintained counter is strictly cheaper. The posterior that steers selection already lives in
  `variant_performance_metrics`, which is written incrementally by `applyOutcomeToPosteriors` (`lib/posterior-update.ts:978`) and
  overlaid onto the view in `paradigm.ts` (comment block at ~`:630`). The view supplies only descriptive columns (durations,
  costs, first/last executed). Shape-conditioned counts can be an UPSERT `+= 1` on a keyed row
  (`shape_score:<hash(activity,org,sig)>`) in the same ingest path. That is O(1) and has no min/max.
  An **in-process cache** of scores is cheaper again for reads (§4 R4), because the process that writes posteriors is the one
  that reads them.

---

## 4. Design, ranked by value / risk

Each item: expected latency · correctness/staleness · files · risk · falsifier.

**R1. Stop the duplicate-delivery amplification (ingest edge).**
- Server: before launching detached side effects (`routes/execution-traces.ts` ~`:2873-2930`), gate them on "this delivery
  created the authoritative row". A duplicate should return 200 early with no side-effect fan-out. Also keep an in-process
  `seen(execution_id)` TTL set (10 min) to short-circuit repeats before any DB call.
- Client: the 15 s timeout is shorter than p50 ingest, so the retry only duplicates work. Make the retry idempotent-aware
  (it already treats "already contains" as ok) and lengthen or jitter the timeout. Better: have the server ack after the
  authoritative insert and move the rest off the response path.
- Latency: removes ~60% of E/F and of all ingest-side DB writes. It also removes the positive-feedback loop.
- Correctness: none lost, because a duplicate carries the same content. Risk: low. Files: `activity-api/src/routes/execution-traces.ts`,
  `ias-executor-ts/src/adapters/activity-api-trace-sink.ts`.
- Falsifier: in a 10-min window, the distinct/total ratio of "Execution trace stored" ids should go to ≈1.0, and E count ≈ distinct new executions.
  If E still exceeds distinct ids by more than 10%, a second duplicate source exists.

**R2. Parent → activity map in process (replaces F), plus the pre-lookup regex.**
- At ingest, `lru.set(execution_id, activity_id)` (bounded, e.g. 50k entries ≈ a few MB, TTL 1 h). In
  `deriveCompositionEdgeFromParent`, check the `/^walk-|!^exec_[a-z0-9]{8}$/` classification **first** (skip the lookup), then check the LRU,
  and only on a miss query the DB, once, with the normalized id rather than raw then bare.
- Latency: < 0.1 ms on a hit. The expected hit rate is high because children follow parents within seconds [I]. A cold miss after restart costs 1 query.
- Correctness: the mapping is immutable, so the cache can never be stale. On a multi-replica deployment each replica has its own cache,
  and misses fall back to the DB. Risk: low.
- Also: parents that arrive **after** their child will miss both cache and DB today (a race, part of the 223 `parent_lookup_miss`
  [I]). A small "pending edges by parent id" map drained at the parent's ingest would turn those misses into edges.
- Files: `routes/execution-traces.ts:1793-1935`.
- Falsifier: F statements per 10 min ≪ 100 and `derive_ok` rate unchanged or higher. If `derive_ok` drops, the cache key form
  (bare vs prefixed) is wrong.

**R3. Children-awaiting-parent set (replaces E).**
- E exists only for the child-before-parent race. At child ingest, if the parent id is not yet known (R2 LRU miss plus DB miss),
  record `orphans[parent_id] += child_id` in process. At parent ingest, run the backfill UPDATE only if `orphans.has(id)`.
  Keep the DB probe only as the fallback after a restart (a boot-time flag for the first N minutes).
- Latency: 0 queries in the steady state, down from 1 per delivery. Correctness: an orphan recorded by another replica or before a restart
  falls back to the probe window. Risk: low to medium (the in-process state must be bounded; evict after 15 min).
- Falsifier: E per 10 min ≈ 0 outside the warm-up window, while the composition_chain backfill UPDATE count stays ≥ its current hit rate (202/10 min).

**R4. Score reads: fix the ids, drop the dead round trips, then serve from an in-process cache.**
- Step 1 (correctness, prerequisite): normalize `activityIds` (strip `activity:` and `⟨⟩`) in **both**
  `getShapeConditionedScores` (`paradigm.ts:1135`) and the legacy branch (`:746`). Remove the `v_activity_score` query
  (`:604`), because the table is absent (also noted at `routes/activities.templates-db.ts:279`). Make the canonical source
  `variant_performance_metrics` read with `variant_id IN $ids` **only**, with the tenancy predicate applied in app code (or
  split into two statements) so the planner uses `idx_variant_performance_variant_id` alone. Do not run the 5-way union.
- Step 2 (latency): an in-process `Map<org|account, Map<activity_id, {alpha,beta,…}>>` loaded once (~3.4k rows) and updated
  **write-through by `applyOutcomeToPosteriors`**, which runs in this same process (`lib/posterior-update.ts:978`). Add a TTL of 30–60 s
  as a safety net for writes from other processes.
- Latency: < 1 ms per recommend (a map lookup over ~1k ids). Cold load: 1 query.
- Staleness: zero for in-process writes; ≤ TTL for any external writer. Thompson tolerates seconds of staleness, because the
  posterior moves by 1 count per graded outcome.
- **Behavior change warning**: fixing the ids turns scores from all-prior `Beta(1,1)` into real posteriors. Selection changes
  on deploy. That is the intended effect, but it is a causal intervention (law 12): ship it alone and record it.
- Files: `db/paradigm.ts:586-770, 1096-1210`, `lib/posterior-update.ts`. Risk: medium (selection behavior).
- Falsifier: "fetched from legacy table" count drops to ~0 (or the new path's log shows `count > 0` with `graded_posteriors > 0`),
  score-read latency_ms p99 < 10 ms, and recommend logs show a `scoreMethod` of `shape_conditioned` for some calls.

**R5. Shape-match candidate pool (D): project, then cache.**
- Project only what `/recommend` reads: `id, name, description, category, execution_type, input_shapes, optional_input_shapes,
  output_shapes, scope, org_id, public, retired, created_at, tags, variant_of`. **No `embedding*`, `tasks`,
  `*_schema`, `metadata`, `variables`**. Row bytes should drop by 10–100× [I: 384-d float arrays alone are several KB/row in JSON].
- Then cache the admitted catalog in process (the `activity` table is small, ~1k–2k rows [I], and writes are rare), and apply the
  `ALLINSIDE` / retired / tenancy filters in JS. Invalidate on activity create/update/retire routes in this process, plus a TTL
  of ≤ 60 s for writes from elsewhere (or a `LIVE SELECT` on `activity`).
- Remove the dead `ORDER BY ev` (the field is absent on `activity`) and sort by `created_at` explicitly if order still matters.
- Latency: projection alone ~5 s → ~0.3–1 s under current load [I]; with the cache, < 5 ms.
- Correctness: PERMISSIONS today are enforced by the JWT connection, so a cache must apply the same predicate in JS
  (`scope='global' AND public` OR `org_id = auth.org_id` OR project membership). **This is the main risk.** Mitigation: cache per
  org, loaded through that org's JWT.
- Files: `db/paradigm.ts:799-900`, `routes/activities.get-activities-with-tiered-fallback.ts:85,230`. Risk: medium.
- Falsifier: "Activities fetched with shape matching" latency p50 < 10 ms (cache) or < 1 s (projection only), with the same `count`
  distribution (927–943) as now. A different count means the JS filter diverged from the SurrealQL filter.

**R6. Retire `v_shape_conditioned_score`, and replace it with an app-maintained counter if shape conditioning is wanted.**
- `UPSERT shape_score:<sha(activity,org,sig)> SET n += 1, s += IF success THEN 1 ELSE 0 END, last_at = time::now()` in
  the ingest path (only on a first-delivery insert, see R1). Reads go through the R4 cache.
- Write cost: 1 keyed UPSERT (~ms), down from a group recompute (~3.6 s [background]). Read: < 1 ms from cache.
- This is design only. `REMOVE TABLE` is a DB write and is out of bounds now. It must ship as a migration after the graded run.
- Risk: medium (a migration; readers at `paradigm.ts:1126,1163,1893` must move first).
- Falsifier: execution INSERT p50 latency (the trace POST response time) drops measurably after removal. If it does not, the view was
  not the write-side cost and the 3.6 s figure does not apply to insert-only maintenance.

**R7. Connection reuse for `queryWithAuth` (only after fixing `surreal.ts:384`).**
- Measured handshake p50 is 80 ms (p90 360 ms), so this is not the dominant cost. It still multiplies: 4,122 fresh WebSocket
  sessions per 10 min. Fix the hard-coded SQL, then enable the per-JWT session pool.
- Latency: −0.08 s p50 / −0.36 s p90 per authenticated query. Risk: **high until line 384 is fixed** (silent wrong results
  for every authenticated read).
- Falsifier: "(pooled)" lines appear, and their results carry the requested SQL's shape. A spot check of the E/F results shows record ids
  and `activity_id`, not template rows.

**Covering indexes**: SurrealDB 2.3 has no index-only (covering) scans. Every index hit still fetches the record from the
fragmented blob store. That is why the fix is fewer and narrower reads plus in-process state, not more indexes. The indexes E and B
need already exist (`idx_execution_parent`, `idx_variant_performance_variant_id`). Removing the OR/NULL union branches from B is the
index-side change that matters.

---

## 5. What I could not measure (and the cheap way to settle each)

- **vpm `variant_id` format distribution.** Inferred bare from 3 logged writes and code. To settle: `SELECT variant_id FROM variant_performance_metrics LIMIT 5`.
- **Live `v_shape_conditioned_score` `activity_id` form**, and a C EXPLAIN (budget). Stored form inferred bare from the
  `execution` normalization comments.
- **View maintenance cost per write.** I did not re-measure the background doc's ~3.6 s. To settle: compare the execution INSERT
  latency distribution before and after R6 (in a maintenance window), or time `EXPLAIN FULL` of the group recompute off-peak.
- **Split of B's ~10 s (p50, 10 pairs only)** between the absent-table query A and the vpm union. Both run inside the same interval.
- **`activity` row count and byte width.** Only bounded: ≥ 943 by the returned counts. Embedding population is not verified.
- **activity-api CPU.** The process restarted at 07:57:47Z (not by me). One 5 s sample of the fresh process was ~0.6 core, which
  is not representative of the window analysed.
- **The share of `parent_lookup_miss` (223) due to the child-before-parent race** versus PERMISSIONS or id form.
