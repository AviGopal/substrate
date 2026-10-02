# perf-3: activity-api FTS (BM25) lookups and the periodic REBUILD INDEX

This was a read-only investigation. I restarted nothing and wrote nothing to the database.
DB access was 2 HTTP requests with 4 statements in total: `INFO FOR TABLE activity`,
`INFO FOR INDEX` ×2, and one plan-only `EXPLAIN`, which took 12 ms.
Logs come from one journal read of activity-api (`--since -40min`, about 07:11–07:51Z,
277k lines, PID 731174), saved to `/tmp/perf3-aapi.log` inside the container.
Note: activity-api restarted at **07:51:44Z**. I did not cause this. The new process's first rebuild fires at about 07:56:44Z,
and its failure is the same known failure, not new evidence.

## 0. Numbers from the 40-minute window

| signal | value |
|---|---|
| `queryActivitiesByFTS: query failed` | **1094** (1018 carry SurrealDB's own "query was not executed because it exceeded the timeout" text, and 76 carry the same text wrapped by the client) |
| failed latency | min 8096 ms, p50 **8603**, p90 11062, max 53203 |
| `queryActivitiesByFTS: completed` | **5**, at 6.2–13.2 s. 3 returned 100 rows with topScore 16.7; 2 returned **0 rows but still took 6–8 s** |
| which queries | **881/1094 are the same string**: `learning-loop-selftest: exercise the execution→learning chain…`. Other repeats: `learning-loop-selftest` 58, `boredomtargettemplate` 56 |
| `queryActivitiesByDense` (same table, no FTS) | 924 runs, p50 **36.9 s**, p90 **93 s**, no TIMEOUT. `candidateCount` is always ≤36, so only about 36 rows carry MiniLM embeddings |
| tiered-fallback blends | 918 of type "Tier 1 + Tier 3 blended", **918/918 with `ftsCount:0`**. 6 query-first |
| `POST /v2/activities/recommend` wall time | typically 58–129 s |
| index state | `idx_activity_fts_name` and `idx_activity_fts_tags` both **`building.status: ready`** |

## 1. Why the FTS queries time out

**Root cause (plan measured, cost inferred): the query shape turns the "index" lookup into a whole-table fetch.**

`EXPLAIN` of the production shape was run plan-only. The shape is
`(name @0@ t0 OR tags @1@ t0 OR name @2@ t1 OR tags @3@ t1) AND (scope='global' OR org_id=$bare OR org_id=$prefixed) ORDER BY fts_score DESC LIMIT 100`.
It returned **7 `Iterate Index` nodes plus a `MemoryOrderedLimit` collector**:

```
idx_activity_fts_name @0@ / idx_activity_fts_tags @1@ / ..fts_name @2@ / ..fts_tags @3@
idx_activity_scope = 'global'
idx_activity_org   = 'substrate'
idx_activity_org   = 'organizations:substrate'
```

Every leaf of the WHERE clause is index-backed (`idx_activity_scope`, `idx_activity_org`), and the expression
is not all-AND. So SurrealDB 2.3.3's planner takes the **multi-index union** of *all* leaves, including the
tenant leaves, and then re-evaluates the full WHERE on each fetched record. The tenant branches
match every row in the tenant's scope, which is most or all of the ~4,003 activity rows (inferred: I spent no query on counts).
Each of those rows is fetched with `SELECT *`. That is about 20 KB per row, because rows carry a 1536-float `embedding` plus two
384-float MiniLM arrays, `tasks`, and schemas. For each fetched row the query then evaluates up to 20 match refs, 20
`search::score()` calls and 10 `description CONTAINS` terms, then sorts everything in memory.

Evidence that this is a scan and not an index lookup: **a query that matches nothing still takes 6–8 s**
(`learning-loop-selftest`, resultCount 0). A true FTS-index lookup that misses costs microseconds.

The other hypotheses:
- **Broken or partially built index: ruled out** (measured). Both indexes report `ready`, and EXPLAIN binds all `@N@` refs to them.
  The 5 completions returned stable non-zero BM25 scores (16.708…).
- **OR clauses / `IF description CONTAINS` / `SELECT *`:** the OR itself is harmless. The damage comes from the AND-ed
  **tenant OR** being index-eligible. The CONTAINS terms and `SELECT *` multiply the per-row cost of the scan.
  They do not change the plan.
- **Timeout value:** the query carries `TIMEOUT 8s` (paradigm.ts, in `queryActivitiesByFTS`). The failure p50 of 8.6 s matches that clamp.
  Raising it would only let the scan run longer and hold more DB CPU.
- **Contention: real, and FTS is also a cause of it, not only a victim.** A completion taking 13 s against an 8 s server
  clamp means the request queued before execution started. The same table's dense path does a
  JS-side scan with `SELECT *` and no TIMEOUT, and runs at p50 37 s. FTS and dense are issued in parallel on every recommend
  (`Promise.all`, in routes/activities.get-activities-with-tiered-fallback.ts). Together that is about **50 full-row scans of `activity` per minute**
  (~1100 FTS + ~924 dense in 40 min). At ~80 MB per scan (inferred: 4k × 20 KB), that is on the order of
  tens of MB/s of record decode inside SurrealDB, a credible share of its ~11 cores.
- **Amplifier:** one self-test goal string was re-issued 881 times in 40 minutes, about every 2.7 s, with no result cache.

**Bigger finding, outside this scope:** the dense path is the dominant recommend latency. Its p50 of 37 s is higher than the
FTS clamp of 8 s. So fixing FTS alone will not make `/recommend` fast.

## 2. Why the REBUILD fails, and whether it is needed

**Failure (measured):** `07:21:46 ERROR SurrealDB query failed {"sql":"REBUILD INDEX idx_activity_fts_name ON activity", "error":"The operation timed out.","errorName":"DOMException"}`.
`DOMException` is a client-side HTTP abort in the Bun/`surrealdb`-SDK 2.0.3 layer (the connection is `http://localhost:8000`).
It is not a SurrealDB error. `db/surreal.ts` passes no timeout, so the limit is the runtime's default. I did not pin the exact value.
If it is Bun's 300 s default, the rebuild started at about 07:16:46, which fits the 30-minute cadence of the 06:20, 06:50 and 07:21 failures.
Consequences, read from code (jobs/fts-rebuild.ts):
- The loop `throw`s on the first index, so **`idx_activity_fts_tags` is never rebuilt** by the periodic job.
- `isRebuildInProgress` clears when the *client* gives up, but the server-side REBUILD almost certainly keeps running
  (inferred: the indexes are `ready`, not rolled back or missing). trace-retention's "defer while REBUILD in flight" guard
  (services/trace-retention.ts:438–464) therefore has a false-clear window, which is the exact hazard that comment describes.
- In 2.x, `REBUILD INDEX` / `DEFINE INDEX` re-processes the table as an internal forced `UPDATE activity` (inferred from
  SurrealDB 2.x design, and consistent with the TRACE-STORE-GROWTH report). That means one large transaction
  rewrites all ~4k rows. Because `updated_at` is `VALUE time::now()`, every row really changes. The
  `v_paradigm_activity_template` view rows are recomputed too. This is the blob-garbage source, and under load it is too slow to finish inside the client timeout.

**Is it needed? No (inferred, with strong evidence).**
- The F-V45/F-V46 claim ("any write to an FTS-indexed table invalidates all BM25 scorer state") was recorded on 2026-05-11
  (openspec/changes/2026-04-26-impulse-activity-loop/tasks.md:958) and attributed to **SurrealDB 3.0.0**. The index.ts
  scheduler comment says the same thing. The deployed server is **2.3.3**. paradigm.ts's own later docstring states that on 2.3.3
  `search::score` returns real non-zero BM25, and that the 3.0.0 workaround targeted "a version never deployed here".
- In 2.x a SEARCH index is maintained **synchronously inside the writing transaction**: document index, doc-length and term
  postings, and BM25 stats. A normal write keeps it current. A write that does not change `name`/`tags` leaves the index keys alone.
- Empirical check: every periodic rebuild in view failed, yet queries at 07:11, 07:16 and 07:23 returned topScore 16.708 with
  normal writes flowing. The scorer was not "permanently 0". The original 0-score symptom most plausibly came from the old
  `IF/CONTAINS` scoring workaround or missing match refs, which were fixed later. It was not index staleness.
- **Conclusion:** the 30-minute rebuild compensates for a bug that is not present on 2.3.3. It costs a full-table rewrite, a
  giant write transaction and blob garbage, and it pauses retention. It also fails every cycle and never reaches the second index.

## 3. How much FTS contributes to selection quality

Structural answer (read from code):
- Final ranking in `/recommend` (routes/activities.ts, after ~6201) is a **Thompson sample plus heuristic boosts**.
  The boosts are tag-match quality from `semantics.getMatchQuality`, shape compatibility, recency, history, scope, impulse relevancy,
  category and output coverage. **`fts_score` is never read** in routes/activities.ts, and neither are list position, `dense_score` or RRF rank.
- So FTS affects the pick only through **candidate-set membership**. On the dominant path (Tier 1 has enough shape matches; 918/924
  calls here), the pool is FTS ∪ dense ∪ tier1, and `filterBySatisfiableInputShapes` then removes shape-infeasible FTS hits.
  An FTS hit changes the pick only if it is (a) shape-feasible, (b) absent from tier1's `limit*3` rows and from dense, and (c) then wins the
  Thompson and boost draw.
- **Measured now:** FTS contributes **nothing**. 918/918 blends had `ftsCount:0`, so selection has run on tier1 ∪ dense alone.
  Earlier "ftsCount 26–36" blends were real, but they add candidates, not ranking.
- **Not measured:** the counterfactual "FTS-only candidate became the pick". The blend logs record counts, not the source of the winner,
  and reading logs from the earlier FTS-working hours would exceed this task's journal budget.

**Recommendation:** trip a circuit breaker now. FTS's quality contribution is at most marginal (membership of a few shape-feasible
extras) and is zero today. Its cost is 8.6 s of wall time and a table scan per recommend.

## 4. Designs, ranked

### 1. Circuit breaker (do immediately, as a stopgap)
- **What:** in `queryActivitiesByFTS`, after N=3 consecutive failures or timeouts, return `[]` without querying for T=5 min, then allow one
  half-open probe. Emit a traced/log event `fts_breaker_open` with the reason. Per law 1, T and N should be a shaped tuning impulse read at use time,
  not an env var. Also add a per-query-string LRU (~60 s TTL) so the self-test's 881 repeats hit memory.
- **Latency:** FTS drops to about 0 ms while open. It removes about 27 table scans per minute from SurrealDB.
- **Quality:** unchanged from today (FTS already returns 0).
- **Files:** `src/db/paradigm.ts` (`queryActivitiesByFTS`).
- **Risk:** low. It hides FTS if FTS is ever fixed but mis-tuned, which the half-open probe mitigates.
- **Falsifier:** within 10 min, SurrealDB CPU and dense p50 fall measurably, and `query failed` stays under 1/min. If dense p50 does *not* move, FTS was not a
  meaningful load contributor and the dense scan is the whole story. **Recommend wall time will not drop much, because dense dominates.**

### 2. In-process BM25 over `id, name, tags` (target design, 1–5 ms)
- **What:** a module-level index in activity-api over ~4k short documents (a few hundred KB), with the same lowercase + snowball-english
  analysis via a JS stemmer and BM25(1.2, 0.75), field boosts name ×2 and tags ×1.5. Keep description as an optional third field.
  Populate it from `SELECT id, name, tags, description, org_id, scope, execution_type, retired, deprecated FROM activity`, which projects no embeddings.
  Refresh (a) from activity-api's own activity write paths (template register, variant mint, retire) and (b) with a slow reconcile every ~10 min.
  Apply the tenant and execution_type filter in JS. Return ids plus scores, and hydrate only the top-K by id.
- **Latency:** 1–5 ms per lookup, and zero DB load per lookup.
- **Quality:** at least today's (today is 0). It reaches parity with working FTS once the analyzer matches. It also fixes the hyphen/AND
  recall issue (see note below).
- **Files:** a new `src/services/activity-text-index.ts`; `src/db/paradigm.ts` (`queryActivitiesByFTS` delegates to it); write-path hooks
  in routes/activities*.ts; the refresh in `src/index.ts`. After it proves out, delete `jobs/fts-rebuild.ts`, the index.ts scheduler, the
  `/internal/fts-rebuild` route and the trace-retention guard, and `REMOVE` both SEARCH indexes in a migration. Removing the indexes also removes FTS write
  amplification on every activity row write.
- **Risk:** medium. Writers outside this process (other vessels writing `activity` directly) are only seen at reconcile.
  Memory is negligible.
- **Falsifier:** `ftsCount` returns to 26–36 on the blend path with `latency_ms < 10` in the log. A replayed set of goal strings gives the
  same top-10 as a one-off SurrealDB FTS run on an idle DB (overlap@10 ≥ 0.8).
- **Same pattern for dense:** only about 36 rows have MiniLM vectors. The dense scan (`SELECT *` with WHERE `…_embedding IS NOT NONE`,
  not index-backed) should become an in-process vector cache as well. That is the larger `/recommend` latency win.

### 3. Fix the SurrealDB query shape (cheapest code change, still DB-bound)
- **What:** keep only FTS leaves in the WHERE so that the union covers just the FTS postings. Move the tenant and execution_type filter out,
  either into an outer `SELECT … FROM (SELECT id, org_id, scope, execution_type, <score> AS fts_score FROM activity WHERE <fts ORs>) WHERE <tenant>`
  or into a JS post-filter. Project ids and small fields only, never `*`. Drop the `IF description CONTAINS` bonus, or compute it in JS on the top-K.
  Hydrate the top-K by id, excluding embeddings.
- **Latency:** inferred single- to low-double-digit ms on an idle DB for rare tokens. Common tokens ("execution", "learning") still fetch
  every posting's full record. Under today's saturation it will still queue.
- **Quality:** the same as working FTS.
- **Files:** `src/db/paradigm.ts`.
- **Risk:** low. Check that `search::score(n)` still resolves inside the subquery, and that JWT/PERMISSIONS paths still filter.
- **Falsifier:** a plan-only `EXPLAIN` shows exactly the 2×tokens FTS `Iterate Index` nodes and **no** `idx_activity_scope` or `idx_activity_org`
  node, and a 0-result query returns in under 50 ms.

### 4. Remove the periodic rebuild (do alongside #1)
- **What:** delete the `setTimeout`/`setInterval` scheduler in `src/index.ts` (~629–677), and keep `/internal/fts-rebuild` for manual use.
  Do **not** build "rebuild-on-invalidation": on 2.3.3 there is no invalidation to react to (§2). Revisit only if the falsifier below fails.
- **Latency:** no direct effect on lookups. It removes a 30-minute full-table rewrite plus the view recompute, a large source of blob garbage, and it
  unblocks trace-retention.
- **Quality:** none, if §2 holds.
- **Risk:** low. If F-V46 were real on 2.3.3, scores would decay to 0. That is detectable, and the manual endpoint remains.
- **Falsifier:** with the rebuild disabled for 24 h, `topScore` stays non-zero and stable for a fixed probe query (e.g.
  `boredomtargettemplate` → 16.7) across activity writes.

**Order:** #1 and #4 now, as small low-risk deletions and guards that each remove DB load. #2 is the durable answer, with #3 as an interim if #2 is
deferred. Everything above can be dispatched as one-file goals against `repos/activity-api/src/db/paradigm.ts` and `src/index.ts`.

## Notes
- Sanitisation keeps `-`, so `learning-loop-selftest` is one `@N@` literal. The `class` tokenizer splits it into several terms with
  AND semantics, so it rarely matches. This is a recall defect that #2 fixes by tokenising the query with the analyzer's own rules.
- `ftsCount` 26–36 against `denseCount` 36 suggests most FTS hits may overlap the embedded 36. This is not verified.

## Could not measure (by design, under the load constraints)
- Per-scope/org row counts, which would confirm the union covers ~all 4,003 rows.
- FTS latency on an idle DB, and the fixed-shape latency. No live search query was run.
- The runtime's exact client-side HTTP timeout value for the REBUILD abort, and whether SurrealDB continues or rolls back the server-side REBUILD.
- The counterfactual of how often an FTS-only candidate became the final pick.
- The SurrealDB 2.3.3 internals (synchronous SEARCH-index maintenance; REBUILD as a forced table UPDATE) come from the 2.x design, not from reading the server source here.
