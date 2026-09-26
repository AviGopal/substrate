# Trace-store growth, part 2: who writes the bytes (2026-09-26 08:29–08:33Z)

Read-only investigation of the SurrealDB store (`/var/lib/surrealdb/data.db`, 45.6 GB) after the
08:21 observation of "~1.5 GB in the last hour". No restarts, no DB writes, no dispatches.

## 1. The 1.5 GB/h was a restart artefact, not steady growth

Files created in the hour before 08:21:

| When | Files | Bytes | What |
|---|---|---|---|
| 07:37 (container stop) | 011007.log, 011017.log, 011018.log, 011021.blob | ~560 MB WAL + 239 MB blob | shutdown flush |
| 07:43 (container start) | 011028–011032.sst | ~624 MB | WAL replay / memtable flush at boot |

That is ~1.4 GB of stop/start churn. The 07:37 WAL files have since been removed; only the live WAL
(011024.log) remains.

**Steady state after the restart (sampled each minute):**

| Time | du (bytes) | live WAL | files |
|---|---|---|---|
| 08:29:31 | 45,635,934,326 | 63.4 MB | 725 |
| 08:30:31 | 45,639,398,068 | 66.9 MB | 725 |
| 08:31:32 | 45,644,280,282 | 71.8 MB | 725 |
| 08:32:32 | 45,646,608,935 | 74.1 MB | 725 |

+10.7 MB in 3 min ≈ **3.6 MB/min ≈ 215 MB/h of raw writes**, all into the WAL. What persists is decided
at the next memtable flush (the WAL rotates near 250 MB, roughly hourly at this rate): small rows
compact away in SSTs; large values go to blob files, and with blob GC off (see TRACE-STORE-GROWTH.md)
every rewrite of a large value is permanent garbage. The long-run trend from the hourly check-ins
(42–43 GB overnight → 45.6 GB, including one stop/start) is ~0.2–0.3 GB/h net.

## 2. Writers in a 10-minute window (row counts via time-indexed read-only queries)

| Table | Rows written / 10 min | Row size | Indexes | Nature |
|---|---|---|---|---|
| execution | 341 | ~0.7 KB | 14 | insert |
| trace_digest | 341 | ~0.4 KB | 5 | insert |
| execution_trace_content | 294 | ~2 KB | 2 | insert |
| concept_usage | 351 | ~0.2 KB | 4 | insert |
| **concept** | **109 distinct rows rewritten** | **~16 KB** (2×384-float embeddings + content) | 10 incl. **HNSW + 2 FTS** | hot-counter UPDATE |
| variant_performance_metrics | 60 distinct rows | ~0.7 KB | 10 | counter UPDATE (×2 per execution) |
| activity | 6 | ~22 KB | 15 incl. 2 FTS | UPDATE |
| impulse | 13 | ~3 KB | 11 | insert |
| goal_execution_paths | 9 | ~1.1 KB | 15 | UPDATE |

Route counts into activity-api over the same 10 min: 440 POST execution-traces, 288 impulses/resolve,
103 mcp/analysis/run, 29 llm-router feedback, 17 goal-paths. (`POST /v2/events/publish` ran 8,409×
— 14/s — but it only broadcasts on the WebSocket and writes nothing to the DB; noted as CPU/network
churn, out of scope here.)

Per-minute correlation over 3 minutes (WAL 3.46 / 4.88 / 2.33 MB vs executions 31 / 91 / 72 and
concept rewrites 11 / 17 / 14) is too short to attribute bytes cleanly; the figures below are
estimates (rows × size), not measurements.

## 3. Ranked writers (estimated) and code sites

1. **Concept hot counters rewrite 16 KB indexed rows** — ~351 usages/10 min each UPDATE
   `times_loaded/times_succeeded/times_failed/relevance` on a 16 KB row carrying HNSW + FTS indexes.
   Logical ≈ 34 MB/h, all large values ⇒ blob garbage that is never reclaimed (~0.8 GB/day), plus index
   churn if the engine re-maintains the vector/FTS entries on each rewrite (not verified).
   Site: `concept-db/src/resolvers/usage.ts:125` and `:132` (also `resolvers/concept.ts:257`,
   `:1128`).
2. **Learning-track classifier rewrites every activity row** — `UPDATE activity SET
   last_classified_at = time::now()` for each template, unconditionally, on every start and every 6 h:
   up to ~2,000 × 22 KB ≈ 44 MB of blob garbage per pass (≥ 4 passes/day + every restart; this
   morning had two). Site: `activity-api/src/jobs/learning-track-classifier.ts:122` and `:147`.
3. **Per-execution learning writes** — each trace writes execution + digest + content (append-only,
   real data, ~10 MB/h) and then two separate `variant_performance_metrics` UPDATEs plus a
   `context_thompson_scores` re-derive that fails ~62×/10 min. Small rows (compactable), but ~3× the
   round trips needed and 10-index maintenance per update. Site:
   `activity-api/src/routes/execution-traces.ts` (~3850–3875 counter update) and
   `routes/activities.ts:943` (thompson reconcile UPDATE).

Sum of the logical estimates (~50 MB/h) against ~215 MB/h of WAL implies ~4× write amplification
from index keys and record overhead — consistent with the index counts above.

## 4. Smallest fixes (none needs a container stop)

| # | Fix | Effect | Stop? |
|---|---|---|---|
| 1 | Move concept usage counters to a small `concept_stats` row (or aggregate from `concept_usage`); touch `concept` only when content/summary changes | removes the largest source of permanent blob garbage and HNSW/FTS churn | no |
| 2 | Classifier writes only when `learning_track` changes; drop the unconditional `last_classified_at` rewrite (or keep it in a separate small table) | removes ~44 MB garbage per pass | no |
| 3 | Merge the two `variant_performance_metrics` updates into one statement; skip the context re-derive when its target row is absent (the 62 failures/10 min) | ~2/3 fewer learning round trips; less index churn | no |

Reclaiming the ~40 GB of existing blob garbage still needs the offline rebuild (export/import or a
RocksDB compaction with blob GC) — that part does require a container stop, as in part 1.

Follow-up measurement: record du + blob file sizes across the next WAL flush (~hourly) to turn the
estimates in §3 into measured bytes/hour.
