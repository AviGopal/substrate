# Trace-store (SurrealDB/RocksDB) growth — investigation

Measured 2026-09-25 06:39–07:05Z on `substrate-live`, read-only. SurrealDB 2.3.3 (links the Rust `rocksdb-0.23.0` crate).
Nothing was restarted and nothing was written to the database. The WAL, MANIFEST and blob files were copied out with `cat` and decoded offline.
Helper scripts are in this directory: `q.sh` (bounded SurrealQL over HTTP), `parse_manifest.py`, `parse_wal.py`, `wal_keys.py`, `parse_blob.py`.

## TL;DR

| | |
|---|---|
| **Root cause (measured)** | activity-api runs `REBUILD INDEX idx_activity_fts_name / idx_activity_fts_tags ON activity` every 30 min (`src/jobs/fts-rebuild.ts`, scheduled in `src/index.ts:649-672`, `FTS_REBUILD_INTERVAL_MS` defaults to 30 min). In SurrealDB 2.x a non-concurrent index build is an internal `UPDATE activity` over every row. That rewrites all 4,003 `activity` documents: about 20 KB each in storage, holding two 384-dim embeddings plus `tasks`. Because `updated_at` is `VALUE time::now()`, every document really changes. The foreign-table view `v_paradigm_activity_template` is rewritten along with it. Every one of those values is over 4 KB, so it goes to a blob. Blob GC is off, so the previous copy is never reclaimed. |
| **Garbage (measured)** | The MANIFEST accounts for 41.26 GB of blob bytes, of which **36.70 GB (88.9%) is garbage** (2.30 M of 2.56 M blobs). 501 of 665 files are more than 90% garbage, and 54 files (5.89 GB) are 100% garbage but still pinned. Live data is about **4.6 GB of blobs plus 0.6 GB of SSTs, roughly 5.2 GB**. |
| **Top writers by bytes landing in blobs** | 1) `activity` whole-table rewrites from the FTS rebuild: 49% of the newest blob file (65% on 08-23, 39% on 07-21). 2) `v_paradigm_activity_template` view copies of those rewrites: 23% (31% on 08-23, 19% on 07-21; on 07-21 `v_activity_by_account` was also a view copy, another 39%). 3) `impulse` inserts of `cluster_shadow_decision`, 70–100 KB each and never expired: 19% (54% on 09-17). |
| **Why retention DELETEs time out** | Not index count and not the FTS lock: batches failed with no rebuild in flight. Deleting an `execution` row that is its group's `time::min` or `time::max` in the aggregate view `v_shape_conditioned_score` forces a recompute of that group, about one full scan of `execution` each. Oldest-first retention hits group minima often. **Inferred** from a quantitative match: the historical best of 3.52 s/row equals a measured 3.59 s filtered full scan of `execution`. All 8 failed-batch head rows are view members, and the first is the view's global minimum. A three-way falsifier is in §3. |
| **Recommended fix** | First, with no DB downtime and both required: stop the 30-min FTS rebuild (d1), **and** give `cluster_shadow_decision` impulses an expiry (d3). Then, in a window of about 15–40 min with **the surrealdb unit stopped (not the container)**: take a backup copy, then run an offline compaction with blob GC forced, using a small tool built on the same `rocksdb` 0.23.0 crate. Rehearse it on the copy and open the result with the same `surreal` binary first. This reclaims about 37 GB. Export/import is the fallback, and the 08-12 attempt failed. |

---

## 1. What is being written

### 1a. Table-level snapshot (`SELECT * FROM <t> LIMIT 2 TIMEOUT 20s` for each of the 99 tables)

Rows whose serialized JSON is over 4 KB, and so are likely blob-resident:

| table | sample row bytes (JSON) | rows (bounded `count() GROUP ALL TIMEOUT 20s`) | large fields |
|---|---|---|---|
| activity | 19,939 – 25,117 (mean 28,388, max 61,813 across all rows) | 4,003 | `name_embedding` 8.4 KB, `description_embedding` 8.4 KB, `tasks` up to 42 KB |
| v_paradigm_activity_template (a **view** over `activity`) | 2,816 – 7,829 | 4,003 | `task_steps` (a copy of `tasks`), shapes |
| v_activity_by_account (a plain table now; it was a view in July) | 18,488 – 60,416 | 5 | embeddings, tasks |
| concept | 373 – 9,010 | 81,813 | `summary_embedding` 8.4 KB |
| impulse | 3,773 – 3,870 (old rows); **68–100 KB for `cluster-shadow-*`** | unknown (the count timed out) | `metadata` |
| embedding_prior_weights | ~15.7 KB | 4,771 | `theta_alpha` and `theta_beta` at 7.7 KB each |
| signature_embedding | ~8.6 KB | 1,212 | `embedding` |
| reconcile_state | 6,779 (1 row) | 1 | `recent_ids` |
| execution | ~786 (median); up to 67 KB for `walk-satisfier-failed-*` | 150,164 (from `trace_store_counters`) | — |

Every row of `activity` has `updated_at` between 05:45:43 and 05:50:32:
```
SELECT time::format(updated_at,'%m-%d %H:%M') AS m, count() FROM activity GROUP BY m TIMEOUT 20s
-> 05:45 659 | 05:46 1212 | 05:47 795 | 05:48 590 | 05:49 489 | 05:50 251 | 05:55 6
```
`DEFINE FIELD updated_at ON activity TYPE datetime VALUE time::now()`: any write to a row rewrites the whole document.

### 1b. Attributing the sweep to the FTS rebuild (measured)

- activity-api started at 01:15:43. The FTS timer fires every 30 min, and 01:15:43 + 9 × 30 min = **05:45:43**, the first `updated_at`.
- `rebuildFtsIndexes()` runs `REBUILD INDEX idx_activity_fts_name ON activity`, then the `tags` index, sequentially.
- The rebuild is one transaction. The 05:45:43 run committed `name` at about 05:50:30 (WAL `010928.log` mtime 05:50:30). The `tags` index then hit the client's 300 s timeout (logged as `Periodic FTS scorer rebuild failed` at 05:55:45).
- The next ticks at 06:15:43 and 06:45:43 both timed out at +300 s (logged at 06:20:46 and 06:50:46) and committed nothing: no `activity.updated_at` in either window.
- There is no other writer: 4,003 row writes do not appear among activity-api's HTTP requests between 05:45:43 and 05:50:30 (99 `POST /v2/activities/:id` in total). No unit started at 05:45. No migration was applied since 09-24. development-vessel, concept-db and goal-host have no `UPDATE activity` statements. Only activity-api, concept-db, development-vessel, relevance-sink and identity hold client connections to :8000 (mapped through `/proc/net/tcp` and `/proc/<pid>/cgroup`).
- Rebuild outcomes over the 24 h from 09-24 05:00 to 09-25 05:00: **16 completed** (each commits 2 full-table rewrites; 13,576 s in total, mean 848 s) and **34 failed** at the 300 s client timeout or later. The journal only starts at 09-24 04:14. **The rebuild occupies the DB for at least 6.6 h/day.** `POST /v2/activities/internal/fts-rebuild` also triggers it on demand (seen 01:40 and 01:54).

### 1c. WAL decode: raw write mix (measured)

`parse_wal.py` groups WriteBatch puts by `(table, key-kind)`: `*` is a record, `+ix` is an index.

**WAL 010928 (04:24 → 05:50:30, includes the committed `name` rebuild): 289.7 MB**

| table / kind | puts | MB | puts > 4 KB |
|---|---|---|---|
| activity `*` | 4,017 | **79.9** | 4,013 |
| activity `+idx_activity_fts_name` | 114,953 | **75.8** | 1,010 |
| v_paradigm_activity_template `*` | 4,017 | **41.7** | 2,338 |
| concept `*` | 3,288 | 32.2 (312 distinct keys, 2,976 rewrites) | 3,209 |
| impulse `*` | 212 | 14.5 (all inserts, mean 68 KB) | 172 |
| execution `*` | 2,839 | 7.1 | 310 |

**One successful single-index rebuild writes about 197 MB (68% of this WAL), and about 121 MB of it is over 4 KB and heads to blobs.**

**WAL 010936 (05:50:30 → 06:52, no rebuild committed): 94.3 MB, which is the steady-state rate**

| table / kind | puts | MB | notes |
|---|---|---|---|
| concept `*` | 2,148 | 20.6 | 391 distinct keys, **1,757 rewrites (17.1 MB)**, up to 75 rewrites per key per hour |
| impulse `*` | 266 | 19.0 | all inserts: `cluster-shadow-*`, 71 KB mean |
| concept HNSW (content + summary) | 733 | 10.4 | |
| concept FTS (content + summary) | 7,083 | 9.6 | |
| execution `*` | 2,109 | 6.3 | 1,450 deletes |
| variant_performance_metrics `*` | 4,715 | 3.6 | a hot key was rewritten 715 times per hour |
| v_shape_conditioned_score `*` + idx | 4,158 | 2.0 | the `validator-dispatch` group was rewritten 748 times per hour |
| trace_store_counters `*` | 1,795 | 0.4 | one row, rewritten 1,795 times per hour |

### 1d. What actually lands in blob files (measured with `parse_blob.py` on sample files)

| blob file (flush date) | size | top contributors |
|---|---|---|
| 010930 (09-25 04:24, newest) | 161 MB | activity 49.0% · v_paradigm_activity_template 22.9% · impulse 19.3% · concept 3.1% · execution 2.7% |
| 010486 (09-17) | 267 MB | impulse 54.0% · activity 29.4% · execution_trace_content 8.7% · execution 5.0% |
| 008822 (08-23) | 237 MB | activity 65.5% · v_paradigm_activity_template 31.2% |
| 006346 (07-21) | 192 MB | v_activity_by_account 39.3% · activity 39.2% · v_paradigm_activity_template 18.9% |

This has been the steady pattern since July: whole-table rewrites of `activity` and the views that copy it.

### 1e. Why the flushes are large and infrequent (measured from `OPTIONS-010832`)

- `write_buffer_size=256 MB`, `min_write_buffer_number_to_merge=6`, `max_write_buffer_number=32`. A flush happens only after about 1.5 GB of WAL, roughly every 3 h. The WAL archive holds 7 × 240–435 MB files from the 04:24 flush.
- Merging memtables deduplicates rewrites inside a window. So concept counter churn (17 MB/h raw) lands as only about 5 MB per flush, while each whole-table `activity` rewrite lands in full once per flush.
- The same setting explains the 18–22 GB RSS: up to 32 × 256 MB of memtables plus the 4 GB block cache (`VmRSS 17.99 GB`, `VmHWM 22.48 GB`).
- Durable blob growth, from blob-file mtimes: about 1.0–1.6 GB/day recently (09-24: 1.35 GB in 10 files). Short-window `du` changes are dominated by the WAL sawtooth: 06:52 → 07:04 was +23 MB, all live WAL. `du` now reads 46.1 GB (42.9 GiB), made up of 42.95 GB blob, 0.60 GB SST, 0.43 GB live WAL and 2.14 GB `archive/`. **The quoted "43 GB" is GiB from `du -h`. I could not reproduce "+0.5 GB/h" as durable growth; it is most likely WAL and archive accumulating between flushes.**

## 2. Live data or garbage? (measured)

Decoding `MANIFEST-010830` (`parse_manifest.py`, BlobFileAddition 400 and BlobFileGarbage 401 records):

```
blob files in manifest 665 ; total blob bytes 41.26 GB ; garbage 36.70 GB (88.9 %)
blobs total 2,561,584 ; garbage 2,301,312
garbage-fraction histogram (decile:files): 0:1 1:4 2:10 3:9 4:7 5:11 6:34 7:26 8:62 9:501
files 100 % garbage but still present: 54 (5.89 GB)
```
(12 files created after the MANIFEST snapshot, 1.69 GB, were not decoded as additions. They are excluded from the percentage.)

- Live is about 4.6 GB of blobs plus 0.6 GB of SSTs, **roughly 5.2 GB of the ~46 GB directory**.
- Why the garbage persists: with `enable_blob_garbage_collection=false`, compaction never relocates live blobs. A 256 MB blob file holding even one live blob stays forever, and 501 files are over 90% garbage. SurrealDB 2.3.3 exposes no GC knob. Its full `SURREAL_ROCKSDB_*` list, read from the binary, contains only `ENABLE_BLOB_FILES` and `MIN_BLOB_SIZE` for blobs.
- Consistency check: the current live `activity` table plus its view copy is about 116 MB. The remaining ~4.4 GB of live blob data is most likely `impulse`, mainly `cluster_shadow_decision`: 70–100 KB each, one per `/recommend` call, `CLUSTER_SHADOW_SAMPLE_RATE` defaults to 1.0, no `expires_at`, and one from 2026-06-28 still exists. This is inferred; the impulse count timed out at 20 s.

The main hypothesis, restated with measurements: **the churn is not counters on large rows. It is a scheduled whole-table rewrite of large rows (`activity` plus its view) about 32–40 times a day**, with concept counter rewrites (`concept-db/src/resolvers/concept.ts:257`, `UPDATE concept SET resolution_snapshot, times_loaded = times_loaded + 1`, which rewrites a ~9.7 KB document) as a minor second source after memtable deduplication.

## 3. Why retention DELETEs of 25 `execution` rows time out

The code (`/vessels/activity-api/src/services/trace-retention.ts:833-904`) is:
`SELECT id FROM execution WHERE executed_at < type::datetime($cut) [AND id NOT IN $skip] LIMIT $batch`
followed by `DELETE $ids RETURN NONE TIMEOUT 20s`. The batch size is 25 (`TRACE_RETENTION_DELETE_BATCH`). A failed batch is quarantined, and the sweep gives up after 20 failures with nothing deleted.

The evidence:
1. **This is not the FTS lock.** The 06:40:57–06:44:41 cycle ran with no rebuild in flight: the 06:15 rebuild had already failed at 06:20:46 and the sweep did not defer. Even so, **11 of 19 batches failed at exactly 20 s** (removed 200, quarantined 275). Over the last 6 h there were 301 failed batches.
2. **This is not the index count alone.** The in-file history records that dropping an index made deletes slower.
3. **The costly rows are group extrema, and each one costs about one full scan of `execution`.** `execution` feeds a foreign-table view: `v_shape_conditioned_score AS SELECT … count(), time::max(executed_at), time::min(executed_at), math::mean(duration_ms), math::mean(cost_usd) … FROM execution WHERE input_impulse_shapes != NONE AND array::len(input_impulse_shapes) > 0 GROUP BY activity_id, org_id, shape_signature` (where `shape_signature` = `array::sort(array::distinct(input_impulse_shapes))`, a computed key that no index can serve). A min or max cannot be decremented. So deleting a row whose `executed_at` equals its group's current `first_executed_at` (or `last_executed_at`) forces a recompute of that group, while other view-member rows can be updated incrementally. A filtered full scan of `execution` (`SELECT count() … WHERE input_impulse_shapes != NONE AND array::len(...) > 0 GROUP ALL`) measured **3.59 s**, and the historical "best observed" delete cost recorded in the code is **3.52 s/row** (with "~88 s per 25-id statement"). "Every view-member row costs a scan" cannot be right: with 64% of cold rows in the view, it would predict that no 25-row batch ever succeeds, yet 8 of 19 did. The version that fits is that **only group-extremum rows are expensive**, so a batch fails when it happens to include about 5 or more group minima. Oldest-first ordering makes that common but not certain.
4. The view is maintained on delete. Its oldest `first_executed_at` (2026-08-21T12:21:49.248Z) is the oldest surviving `execution` row, `exec_ymvyyzsy`, which heads the failed batches. All 8 logged failed-batch head ids are view members, against 64% of cold rows (192 of 300) and 73% of hot rows (219 of 300); 0.64⁸ ≈ 3%.
5. Contradicting or unresolved: group size (the indexed per-activity count) does not separate the failed heads, which ranged from 1 to 32,025. So either the recompute is not index-bounded (a full scan, consistent with 3.59 s) or the head row is not the costly row in its batch. The view is also imperfect: `sum(total_executions)` is 65,955 against 73,470 view-member rows.
6. Conflicts: the `execution` insert path shares hot view and group rows. There were **650 `read or write conflict` failures per hour** on `context_thompson_scores re-derive` (a separate learning data-loss issue, noted here only).

**Status: inferred, with a quantitative match. Falsifier** (needs a write, so do it in the window or on a copy): time three single-row deletes of cold rows:
- (a) a row whose `executed_at` equals its view group's `first_executed_at`;
- (b) a view-member row that is **not** its group's minimum;
- (c) a row that is not in the view (empty `input_impulse_shapes`).

The prediction is that (a) takes about 3–4 s while (b) and (c) take about 0 s. The code history already records "DELETE <1 id> 0.0s" on some rows. If (b) is also slow, the cause is view membership rather than being the extremum. A confirming intervention is to redefine the view with count and sum only and repeat (a).

## 4. What else burns CPU in surrealdb

- `journalctl -u surrealdb`: only 13 lines today, all `A transaction was dropped without being committed or cancelled`. **Each one matches an FTS rebuild failure to the second** (00:17:00, 00:47:00, 00:57:00, 01:54:43, 02:20:43, 02:55:44, 03:20:44, 04:50:45, 05:20:45, 05:55:45, 06:20:46, 06:50:46), plus the 01:15:42 activity-api restart. This is measured: **a rebuild that times out at the client's 300 s is aborted and rolled back server-side.** It costs about 5 min of full-table work and leaves no data. **There is no query logging at `info`, so per-query CPU attribution was not measurable.**
- A 10 s per-thread sample at 07:03:45 showed **`surrealdb-worke` threads using 7.99 cores** and other threads 0.62. That window was a burst of about 64 `execution` inserts in 30 s (4× the hourly mean), each maintaining 14 indexes, the aggregate view and `context_thompson_scores`. No FTS tick was due then.
- The largest scheduled consumer is the **FTS rebuild, at least 6.6 h/day** of full-table rewrite plus BM25 build (§1b).
- Recurring query shapes in activity-api over the hour 05:50–06:50 (`Executing authenticated query` log):
  1. `SELECT VALUE id FROM execution WHERE parent_execution_id = $p`: 1,455/h
  2. `UPDATE activity_template SET total_executions = …`: 1,445/h. **`activity_template` has 0 rows**, so this is a dead write on the hot path.
  3. `LET $existing = (SELECT * FROM context_thompson_scores …)`: 1,068/h (the conflict source)
  4. `SELECT activity_id FROM type::thing('execution',$pid)`: 1,035/h
  5. `SELECT * FROM v_shape_conditioned_score WHERE …`: 446/h
  6. `UPDATE activity_execution_traces SET composition_chain`: 343/h
  7. The FTS search query `SELECT *, (2.0*search::score(0)) + …`: 222/h, and `queryActivitiesByFTS` failed 27 times in 6 h
- Failures in 6 h (activity-api "SurrealDB query failed", by statement): `INSERT INTO execution_trace_content` 765, `SELECT count(DISTINCT shape_signature) FROM execution …` 495 (`routes/impulses.ts:1672`, a scan of `execution`), `INSERT INTO execution_exemplar` 480, `DELETE $ids … TIMEOUT 20s` 301, `[Replication] pull batch failed` 104.
- concept-db writes: every concept resolve rewrites the concept document (`concept.ts:257`), and 81,813 concepts carry both FTS and HNSW indexes.

## 5. Options

| option | expected effect | risk | downtime | container stop? |
|---|---|---|---|---|
| **(d1) Stop the periodic FTS rebuild.** `activity-api/src/jobs/fts-rebuild.ts` and `src/index.ts:649-672`: rebuild only when a probe shows BM25 scores are cold (all-zero), or after N activity inserts, never on a timer. Also gate `POST /v2/activities/internal/fts-rebuild`. | Removes about 72–97% of blob writes (§1d), frees at least 6.6 h/day of DB time, and ends the rebuild/retention phase lock | Low. concept-db's own comment (`concept.ts:599-604`) says REBUILD INDEX does not restore the in-memory IDF state anyway, so the periodic rebuild doesn't achieve its stated purpose. A term-frequency proxy fallback already exists in `concept.ts`; an equivalent for activity would be needed. 2 of the 3 rebuilds per hour are also pure waste: every timed-out rebuild is rolled back server-side (measured, §4) | None to the DB; activity-api restarts (seconds) | No |
| **(d2) Take embeddings out of the `activity` document** (a side table keyed by activity id) and stop `v_paradigm_activity_template` from copying `tasks` | Most activity rows drop under 4 KB, so any rewrite goes to SSTs where normal compaction reclaims it | Medium: readers of `name_embedding`/`description_embedding` (`routes/activities.ts:1055`, `index.ts:803-828`) need to move | Needs a migration; no DB stop | No |
| **(d3) Cap `cluster_shadow_decision` impulses** (`routes/activities.ts:7470`): give them `expires_at` so concept-db's expiry prune takes them, trim `decisions` from metadata, or record them as trace rows | Stops about 15–19 MB/h (0.35–0.45 GB/day) of live growth | Low (observability-only data) | None | No |
| **(d4) Concept counters** (`concept-db/src/resolvers/concept.ts:257`): stop rewriting the document with its embedding to bump `times_loaded`; `concept_usage` already exists | Removes about 17–29 MB/h of raw rewrite (small after memtable deduplication) | Low | None | No |
| **(d5) `v_shape_conditioned_score`**: redefine without `time::min`, `time::max` and `math::mean` (keep count and sums; derive the mean in the reader), or maintain it in the writer | Deletes become cheap if the §3 inference holds; retention can drain the surplus | Medium: used 446/h by discover-by-shapes; run the falsifier first | Migration only | No |
| **(b) `SURREAL_ROCKSDB_ENABLE_BLOB_FILES=false`, or `MIN_BLOB_SIZE` = 64 KB–1 MB** | Future large values go inline in SSTs, where level compaction drops overwritten versions, so churn stops accumulating. **Existing garbage is not reclaimed**: without GC, a blob file pinned by one live blob never goes away | Low to medium: more compaction write-amplification on 20–60 KB rows (fine at about 5 GB live); existing blob refs stay readable | A surrealdb unit restart (every vessel sees DB errors for a few seconds; the 09-24 restart had activity-api back within 11 s) | No |
| **(a′) Offline RocksDB compaction with blob GC forced.** Use a roughly 20-line Rust tool built on **`rocksdb = "0.23.0"`, the exact crate the `surreal` binary embeds**, so the RocksDB format matches by construction; don't hunt for a version-matched `ldb`, which isn't in the image. Open the directory with `set_enable_blob_files(true)`, `set_enable_blob_gc(true)`, `set_blob_gc_age_cutoff(1.0)` and `set_blob_gc_force_threshold(0.0)`, then call `compact_range(None, None)`. Sequence: `systemctl stop surrealdb` (`avoid_flush_during_shutdown=false`, so the memtables flush first), `cp -a data.db` to a backup (46 GB; 1.1 TB free), run the tool **on the copy first**, then **open the compacted copy with the same `surreal` 2.3.3 binary** (`surreal start --bind 127.0.0.1:8001 rocksdb:/path/copy`, then `INFO FOR DB` and a few `count()`s) before running it on the live directory or swapping directories | Reclaims about 37 GB in place, leaving about 5–6 GB; no logical re-import, so none of the parse or view-conflict risks of (a) | Medium. The rehearsal counts as a check only if the compacted copy is opened by the same `surreal` binary. The RocksDB major version under crate 0.23 is **inferred (9.x), not verified** | About 15–40 min of unit downtime if the tool is built and rehearsed in advance (**an estimate**); the rehearsal can run on the copy while the service is back up | No (unit only), but every vessel is degraded while it runs |
| **(a) Export/import rebuild** | Reclaims everything, leaving about 5 GB | **High. The 08-12 attempt failed**: `rebuild.log` ends `DONE ok=3 fail=6` (a chunk split mid-string caused a parse error, exported view rows collided on `v_paradigm_activity_template`, `init_migrations` hit a duplicate index, and HTTP health checks failed during import). 425 July blob files are still in `data.db`, so the store has not actually been rebuilt since at least July | Import ran about 1.5–2.3 min per ~170 MB chunk (about 12 min per GB of surql). Current surql size is unknown (live about 5.2 GB binary, embeddings inflate as text), estimated at 5–12 GB, which is **1–2.5 h import** plus export time (not logged on 08-12) plus FTS and HNSW builds for 81.8k concepts (unknown). Plan for **2–4 h** | The surrealdb unit is stopped, which is effectively a full outage |
| **(c) Upgrade SurrealDB to a version with blob GC** | **Unknown.** I could not check release notes from inside. Code comments already cite "SurrealDB 3.x" (`concept.ts:599`, `activities.ts` Phase B1) while the binary is 2.3.3, so they are misattributed. A 2.x → 3.x move needs export/import anyway, with the same risk as (a) | Unknown | Unknown | Likely an image rebuild |

**Recommended order:**
1. **d1 and d3 together, both required.** d1 stops most of the garbage production. d3 matters because, once d1 lands, the growth line becomes the never-expiring `cluster_shadow_decision` inserts at about 15–19 MB/h (about 0.4–0.5 GB/day of *live* data that no compaction or GC can reclaim). The per-day garbage fraction already shows this cohort: about 95% garbage through early September, falling to 30–60% from 09-16. Neither needs DB downtime.
2. d5, after its falsifier. Optionally (b) at the same time, with a unit restart only.
3. (a′) in one window of about 30–60 min with the surrealdb unit stopped (not the container).
4. Keep (a) as the fallback, with the 08-12 failure modes fixed first.

## 6. What should run automatically afterwards

The existing detector is blind to this class. `trace_store_health_observer` (`development-vessel/src/seed/trace-store-health-observer.ts`, fired every 10 min by `trace-store-health-check.service`) only compares `execution` **row_count against cap**. A store that is 89% garbage passes it.

Extend that same activity rather than minting a new one (law 3). It should emit `substrateGap(category=trace_store_reconciliation)` on either of two signals:
1. **Blob garbage fraction.** Decode the RocksDB MANIFEST BlobFileAddition/BlobFileGarbage records (`parse_manifest.py` here is about 80 lines) and gap when garbage exceeds 50% or 10 GB. This reads on-disk metadata only, is cheap, and works without GC support.
2. **Whole-table rewrite rate.** For each table, if the rows with `updated_at` in the last hour reach or exceed 90% of the table's rows while the table holds more than 4 KB rows, gap and name the table. This would have caught `activity` in July.

`db-contention-check` (`db_contention_observer`) is the natural place for a third signal: the rate of retention `batch FAILED` lines per hour.

## Could not measure

- Row counts for `impulse` and `execution_trace_content`: `count()` exceeded the 20 s bound, so the ~4.4 GB of live non-activity blob data is attributed to `impulse` by inference only.
- The SurrealDB 2.3.3 source path for view recompute on DELETE: no source in the environment, so §3 is an inference and its falsifier needs a write.
- Per-query CPU inside surrealdb: `info` logging has no query log, and the RocksDB `LOG` files are 0 bytes.
- Blob GC in newer SurrealDB releases (c), the `ldb` version match and the (a′) duration.
- (Resolved) Timed-out rebuilds do not keep running: the surrealdb "transaction dropped" warnings match them to the second (§4). The 07:03 8-core sample was therefore traffic, since the 06:45 rebuild had been dropped at 06:50:46.

## Incidental findings

- **Security:** the SurrealDB root password is on the `surreal start … --pass …` command line, so it is readable from `/proc/<pid>/cmdline` by anything in the container. During this investigation one `/proc` scan printed a prefix of it into this session's transcript, so **rotate it**, and pass it through the environment or a file instead.
- `UPDATE activity_template SET total_executions …` runs about 1,445/h against an empty table.
- `context_thompson_scores` re-derive loses about 650 updates per hour to optimistic-transaction conflicts.
- The WAL archive (`archive/`, 2.14 GB) exceeds `WAL_size_limit_MB=1024`. It is transient and bounded, but it counts in `du`.
