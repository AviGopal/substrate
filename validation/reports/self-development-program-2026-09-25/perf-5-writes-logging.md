# activity-api: dead and redundant writes, and logging volume

Read-only investigation, 2026-09-25. Evidence window: one `journalctl -u activity-api --since -10min`
capture, 07:41:23Z to 07:51:25Z (76,959 lines, 52,077,680 bytes; saved at
`/home/avi/.claude/jobs/ac8b0aad/tmp/aapi-10m.log`). Source: `/vessels/activity-api/src`, which matches
`/workspace/git/vessels/activity-api` HEAD `88f1769` for the three files diffed. There were 4 SurrealQL
statements (two `LIMIT 1 TIMEOUT 10s` and two `INFO FOR TABLE`). Nothing was written or restarted.

**Tags:** **[M]** = measured in this window or DB. **[S]** = read from source. **[I]** = inferred.

Note: `activity-api` was restarted at 07:51:42 by `self-recovery-tick` ("UNHEALTHY: activity-api (:8080)
— restarting"). That was not caused by this investigation. It shows the overload loop described in §0.

---

## 0. Findings outside the four areas (they dominate the four areas)

### 0a. Every trace is ingested about 2.5 times [M]
- 855 `Execution trace stored` lines cover **339 distinct execution_ids**: 207 ids ×3, 102 ×2, 30 ×1.
- 513 `[paradigm] Authoritative execution write failed`, of which 744+372 errors were "`execution:…` already exists".
- Cause [S+M]: the emitter `ias-executor-ts/src/adapters/activity-api-trace-sink.ts:317` uses
  `AbortSignal.timeout(15000)` and `postWithRetry` (up to 3 attempts, :347). The server-side POST
  `/v2/activities/execution-traces` latency is **p50 46 s, p90 118 s, p99 154 s** [M, 811 requests]. Every
  POST times out on the client, and the client re-sends while the server is still processing.
- What a duplicate costs [S, execution-traces.ts:2357–3250]: the duplicate check only happens at the authoritative
  `execution` insert (`:3234`, which throws at `:3247`). Before that, each duplicate re-runs the AET insert,
  `insertTraceDigest` (557 failures), `insertTraceContent` (536 failures), the exemplar insert (351 failures),
  the composition-chain probe and UPDATE (§3), and the composition-edge derive. It does **not** double-count posteriors,
  because the Thompson block starts after the throw.
- Fix: put a point lookup `SELECT VALUE id FROM type::thing('execution', $id)` (about 0.4 ms) at the top of the handler
  and return the idempotent 200 immediately. Separately, stop the client from racing the server: either accept with 202
  after the authoritative write and detach the side effects, or have the client send an idempotency key and use a
  timeout above the server's p99.
- Expected effect [I]: roughly 60% of trace-ingest DB statements removed, about 2,000 fewer ERROR lines per
  10 min (5 MB), and the load → timeout → retry amplification loop broken.
- Falsifier: `distinct(execution_id)/count(Execution trace stored)` in a 10-min window should be ≥ 0.98.
  Today it is 0.40.

### 0b. The JWT query path opens a new WebSocket for every query, and the pool that would fix it is broken [S+M]
- `db/surreal.ts` `queryWithAuth`: the pool is used only when `DB_POOL_ENABLED==='true'`
  (`db/auth-session-pool.ts:107`). The variable is **unset** in `/etc/substrate/env` and in the process environment [M].
  So every call takes the legacy path: `createAuthenticatedClient` (connect, use, **authenticate JWT**), then query,
  then close. This happened **3,922 times per 10 min (6.5/s)** [M]. The code comment puts the handshake at 200–300 ms cold.
- The legacy path also has **no conflict retry**. Only `SurrealDBClient.query` retries 4× (`surreal.ts:~245`).
  This is why all the measured CTS conflicts are dropped (§2).
- **Latent defect:** the pooled branch at `db/surreal.ts:384` executes a hard-coded
  `session.db.query('SELECT id, name, description, content, created_at, updated_at FROM template', params)`
  **instead of `sql`**. It was introduced by `b1cd133` (Substrate Autonomous, 2026-07-17, "apply
  route-edit-62ca912f-compose-report via mitosis cutover"). If the pool were enabled as the code stands, every
  JWT-scoped read would return `template` rows and every JWT-scoped write would silently not run. **Fix line 384 before
  anyone turns the pool on.** Then add the same conflict retry to both auth paths. Under law 6, the missing detector
  is a test that exercises the pooled branch.

---

## 1. `UPDATE activity_template SET total_executions …`

**Is the table empty?** Yes [M]. `SELECT id FROM activity_template LIMIT 1 TIMEOUT 10s` returned `[]` in 0.38 ms.
`INFO FOR TABLE` shows the counter fields are still defined (`failed_executions`, `successful_executions`, …).

**Site** [S]: `routes/execution-traces.ts:3331–3342` builds the UPDATE. The loop at `:3390–3439` runs it once per
candidate id from `resolveTemplateIdsForUpdate`, using JWT `queryWithAuth` when a token is present (so a new WS
connection each time) and root otherwise. `WHERE (record::id(id) = $activity_id OR name = $activity_id) AND (org_id = … OR …)`
cannot use an index, so it is a table scan. That is trivial today only because the table is empty.
- [M] 263 of these UPDATEs were logged on the JWT path in 10 min. The root-path ones are logged at debug, so they are not
  counted here; the caller's figure of about 388/10 min presumably includes both paths. **278 × WARN**
  `Thompson Sampling score update returned no results in either table`, and **0 ×** `activity_template counters updated`.
  So the UPDATE never matched once in the window.
- There is also a dead read that belongs to the same block: `:3266` `SELECT output_shapes FROM activity_template … LIMIT 1`
  (and a twin at `:2549`). It always returns nothing, so shape-match scoring always takes the "binary success" branch
  (`:3311`).
- The Redis invalidation at `:3418–3429` is gated on a match, so it never runs.

**Who reads the counters?** [S] Nobody reads them from `activity_template`. The template listing at `routes/activities.ts:4745`
does not select them, and `db/paradigm.ts:959` does not either. Counter consumers read `variant_performance_metrics`
(`db/paradigm.ts:703–711`: `total_executions`, `successful_executions`, `failed_executions`) or the `execution` table.
No other vessel reads `total_executions` from `activity_template` (grep of `/vessels/*/src`). The comment at `:3330`
("kept for dashboard display") no longer has a reader.

**Recommendation: remove, don't relocate.** Delete the UPDATE loop (`:3331–3439`, keeping the fan-out only if something
else needs `candidateIds`) and the two dead `SELECT output_shapes` reads. `variant_performance_metrics` already carries
the same counters for the reader that exists.
- Effect: per new trace, 1–2 fewer write transactions, 1 fewer read, and on the JWT path 1–2 fewer WS handshakes.
  About 280 fewer WARN lines per 10 min.
- Risk: low. Shape-match scoring is already inert. If `activity_template` is ever repopulated, the scoring path should
  read `output_shapes` from `activity` instead, which is a separate question.
- Falsifier: after the change, zero `UPDATE activity_template` statements in the SurrealDB statement stats or the
  activity-api debug log. `variant_performance_metrics` counters keep growing at the same rate as distinct traces.

---

## 2. `context_thompson_scores` read-modify-write and conflicts

**Writers** [S]. Grep for UPDATE, CREATE, INSERT and UPSERT on the table:

| # | Site | Keyed on | Client | Retry on conflict |
|---|---|---|---|---|
| W1 | `routes/execution-traces.ts:2701` (v2 repair signature) | org, template, sv=2, bucket | root | yes (4×) |
| W2 | `routes/execution-traces.ts:3661` (v0 bucket from metadata) | `accountIdScopedWhere()`, template, bucket | **JWT (legacy)** | **no** |
| W3 | `routes/execution-traces.ts:3750` (v0 re-derived bucket) | same as W2 | **JWT (legacy)** | **no** |
| W4 | `lib/posterior-update.ts:1226` (v1 leaf, with decay and a cardinality count) | org, template, sv, sig | root | yes |
| W5 | `lib/posterior-update.ts:690` (chain credit, up to 4 ancestors per composed trace) | org, **ancestor** template, sv, sig | root | yes |
| W6 | `routes/activities.ts:11594` (relevance feedback) `INSERT … ON DUPLICATE KEY UPDATE` | no id, **no unique index** | root | yes |
| W7 | `lib/cluster-posterior.ts` (cluster rows) | **deterministic sha256 slug**, `UPSERT type::thing(…)` | root | yes |

`jobs/signature-cluster-tick.ts`, `jobs/accelerator-flag-tick.ts`, `services/embedding-prior-trainer.ts` and
`utils/session-context.ts` only **read** the table; none of them write it (grep).

**Is it non-atomic?** Yes [S+I]. W1–W5 are `LET $existing = (SELECT …); IF … UPDATE … WHERE … ELSE CREATE … END`
sent as one multi-statement query with no `BEGIN`/`COMMIT`.
- In SurrealDB 2.x each statement is its own transaction [I, standard 2.x semantics; not tested here].
- Consequence 1: two first-time writers can both see an empty row and both CREATE it.
- Consequence 2: the row ids are random (`context_thompson_scores:000o7aydrbsq93470mz6` [M]), and the matching index is
  **not UNIQUE** (`idx_ctx_ts_versioned ON org_id, template_id, signature_version, context_bucket` [M, INFO FOR TABLE]).
  So the second CREATE succeeds and leaves a duplicate cell. Later `UPDATE … WHERE` calls then increment both rows, while
  readers take `LIMIT 1`.
- W6 is always an insert [I]: `ON DUPLICATE KEY` only fires on a unique-index or id collision, and neither exists.
- The comment at posterior-update.ts:1215 ("one atomic script") is incorrect.

**Which writers conflict** [M+I]:
- **90 × `context_thompson_scores re-derive update failed` with "read or write conflict"** in 10 min, which is about 540/h and
  matches the reported ~650/h. All 90 come from **W3**. There were 0 W2 failures, 0 W4 (`v1 write failed`) and 0 W5.
- W3 runs through JWT `queryWithAuth`, which has no retry, so **each conflict is a dropped posterior update**.
- Denominator: 185 `LET $existing = (SELECT * FROM context_thompson_scores WHERE (acc…` statements went through the JWT path
  (W2 and W3 share identical SQL). So **≥ 49% of JWT-path v0 writes were dropped** in this window [M, 90/185].
- W1, W4 and W5 conflicts are retried silently by the root client, so they are not observable in the logs. Each retry
  re-runs the full script after 25–200 ms of backoff [S, not measured].
- Contention [I]: about 50 traces are in flight at once (46 s latency × about 0.57 new traces/s). Traces of the same template
  with the same shapes hit the same v0 re-derived bucket. W3 reads through the dual-tenant `OR` WHERE, which makes the
  read set a range, so any concurrent write in the range conflicts. W4 and W5 overlap when an ancestor's
  (template, signature) equals another trace's leaf key.
- **Semantic bug in W3** [S]: `rdAlphaDelta = trace.success ? 1 : 0` (`:3740–3741`) uses **exit status**. W2 uses
  `classifyReach` (`:3640–3651`). So hollow completions are credited as successes in re-derived v0 buckets. The fix
  below should apply the reach verdict to W3 as well.

**Design: one atomic statement per cell on a deterministic id, fed by a per-key coalescer.**
1. Id: `ctsSlug = sha256(org|account|template|sig_version|bucket).slice(0,32)`, the same form as
   `clusterRowSlug` (`lib/cluster-posterior.ts:220`).
2. Statement (W1–W6 all use it):
   ```sql
   UPSERT type::thing('context_thompson_scores', $slug) SET
     org_id=$org_id, account_id=$account_id, template_id=$tid, context_bucket=$sig, signature_version=$sv,
     alpha = 1 + ((alpha ?? $alpha0) - 1) * $decay + $da,     -- $decay=1 for v0/v2
     beta  = 1 + ((beta  ?? $beta0)  - 1) * $decay + $db,
     n_observations = (n_observations ?? 0) + $n,
     last_updated_at = time::now(), created_at = created_at ?? time::now();
   ```
   - The W4 decay can stay inside the `SET` by computing `$decay` from `last_updated_at`, as the current expression does.
   - A single-key point transaction has no range read, so it has no conflicts with other keys.
   - Because the id is the key, no duplicate cells can be created.
   - Move the cardinality cap (W4's per-write `SELECT count() … GROUP ALL`) to the rare create path: attempt
     `UPDATE type::thing(…) … RETURN id`, and only if it returns nothing check the cap and UPSERT. Better still, cache
     per-template bucket counts in memory.
   - `seedPriorFromConcepts` and `lookupEmbeddingForSignature` currently run on **every** W4/W5 write, including for existing
     rows [S, :1219–1224, :675–681]. Call them only on the create path.
3. Single writer per key: extend the existing VPM coalescer (`enqueueVariantDelta`, used at `posterior-update.ts:647`)
   to CTS keys. Fold (Σδα, Σδβ, n) per slug and flush every 250–500 ms with one UPSERT per key. The queue is in process,
   and activity-api runs as a single process, so this is effectively a single writer.
4. Add conflict retry to both `queryWithAuth` paths as a backstop (the same 4× backoff as `surreal.ts:~245`).
5. Migration: fold the existing random-id rows into their slug rows in a maintenance window (post-run). Then add
   `DEFINE INDEX … UNIQUE` on (org_id, account_id, template_id, signature_version, context_bucket) so duplicates become
   impossible. Until the fold is done, readers that use `LIMIT 1` would see either the legacy row or the slug row, so the
   fold has to ship together with the writer change.

**Expected latency** [I, with measured anchors]:
- Point operations on this instance under the current load: 0.38 ms (`LIMIT 1` on an empty table) and 4.8 ms (`LIMIT 1` on CTS).
- A point UPSERT by id should take about 1–5 ms at the current load and sub-millisecond when idle.
- Today's costs: a JWT handshake for W2/W3, then a range SELECT, then a range UPDATE, plus a count range scan and a
  concept seed lookup for W4.
- Coalescing takes posterior writes off the request path entirely, so they cost 0 ms of request latency.

**Proof that no update is dropped** (pre-register this before the change):
- For v0 and v2 cells (no decay), the invariant is Σ over rows of Δ(α+β) = count of graded outcomes submitted to that sink.
  Equivalently, Σ Δ `n_observations` = the number of sink calls.
- Instrument each sink with an in-process counter `cts_writes_submitted{sink}` and one for acknowledged writes.
  Also count `n_observations` deltas per window using a slug-set read, which is a set of point lookups, not a scan.
- For v1 cells, decay changes α and β, so use the `n_observations` delta only.
- **Falsifier:** over a 10-min window, `Σ Δn_observations / submitted` must be exactly 1.000, and "read or write conflict"
  WARNs must be 0. Today's predicted value on the W3 path is about 0.51.
- Duplicate-cell falsifier (run post-run, it is a full scan): `SELECT org_id, template_id, signature_version, context_bucket,
  count() AS c FROM context_thompson_scores GROUP BY … ` with `c > 1`. It must be 0 after the fold. Its value today is
  **not measured**.

---

## 3. `UPDATE activity_execution_traces SET composition_chain = $new_chain`

**Site** [S]: `backfillChildCompositionChains`, `routes/execution-traces.ts:1696–1784`, called fire-and-forget from `:2896`
on **every** trace store, duplicates included.
- It probes `SELECT VALUE id FROM execution WHERE parent_execution_id = $id LIMIT 1` (indexed).
- If any child exists, it runs the JWT UPDATE on `activity_execution_traces` (`:1747`) **and** a root UPDATE on `execution`
  (`:1755`), which is not logged at info.
- [M] There were 838 probes and **189 JWT UPDATEs** (22% of probes).

**Why so many chain rewrites** [S+I]:
- The probe asks "does this trace have any child?", **not** "does it have a child whose chain is still empty?". The
  `(composition_chain IS NONE OR = [])` guard lives only in the UPDATE. So the UPDATE (two write transactions) runs for
  every parent that has children, even when every child was already chained at insert.
- The 2.5× redelivery (§0a) means the 2nd and 3rd POST of a parent almost always find children that arrived in between.
  Those UPDATEs match 0 rows but still open write transactions and a WS handshake.
- True backfills happen only for bottom-up emitters: minibob L1/L2 meta-traces that post after their children.

**Can the chain be written once at insert?** Yes. The chain is a pure function of the ancestry ids:
`chain(child) = chain(parent) ++ [parent_execution_id]`.
- The emitter already knows `parent_execution_id` when it posts a child, because the parent id is minted before the
  parent trace is posted. So it can carry `composition_chain` on the child.
- `ias-executor-ts` stamps `parent_execution_id` on nested children, and minibob's `composition-chain.ts` holds the same
  contract.
- The server already has a read-time fallback (`resolveCompositionChain` and `applyChainFallback`,
  `routes/execution-traces.ts:2292`, `:2319`).

Steps, in order of cost:
1. Now: add `AND (composition_chain IS NONE OR composition_chain = [])` to the probe (`:1720`), so the UPDATE only runs
   when there is something to write. Skip the backfill entirely on duplicate delivery (§0a).
2. Emitters send `composition_chain`. The server stops backfilling and keeps the read-time fallback for legacy rows.
3. Drop the AET mirror UPDATE if no chain reader still reads `activity_execution_traces`. The comment at `:1793` calls
   AET "frozen" for edge derivation. The readers of `walkCompositionChain` were **not verified** in this pass.

Effect [I]: about 190 JWT UPDATE transactions plus 190 root UPDATEs per 10 min become about 0 (plus the rare genuine
bottom-up case), and about 840 probes become about 340.
Falsifier: `UPDATE activity_execution_traces SET composition_chain` ≤ 5 per 10 min, and the share of `execution` rows with
an empty chain and a non-empty `parent_execution_id` is not higher after the change.

---

## 4. Logging

**Volume** [M]: 76,959 lines and 52.1 MB per 10 min. That is **128 lines/s and 87 KB/s, about 7.5 GB/day** into journald.

| Shape (level) | lines/10 min | bytes/10 min | Site |
|---|---|---|---|
| `Executing authenticated query` (INFO, full SQL **plus params**) | 3,922 | **36.97 MB (71%)** | `db/surreal.ts:378` (pooled), `:395` (legacy) |
| …of which `v_shape_conditioned_score` reads (about 44 KB/line: `activity_ids` param list) | 522 | 22.8 MB | caller: recommend path |
| …`v_activity_score` reads | 265 | 9.5 MB | |
| `API key authenticated` (INFO) | 11,256 | 0.89 MB | `middleware/jwtAuth.ts:296`, `:493` |
| `[auth-cache] hit` (INFO) | 11,182 | 0.96 MB | `middleware/auth-cache.ts:116` |
| `SurrealDB query failed` (ERROR, sql plus params) | 2,036 | 5.10 MB | `db/surreal.ts` error path; about 1,900 are the expected duplicate errors from §0a |
| `Authenticated query result` (INFO) | 3,387 | 0.39 MB | `db/surreal.ts:404` |
| hono access log (`<--`/`-->`, 2 lines per request) | about 26,000 | about 1.3 MB | `index.ts:11` (`hono/logger`) |
| `[paradigm] insertExecution query` (INFO) | 775 | 0.20 MB | `db/paradigm.ts:451` |

Level config [S+M]: `config.ts:261` sets `LOG_LEVEL` with a default of `info`, and `LOG_FORMAT` with a default of `text`.
Neither is set in the env or the process, so the service runs at INFO. The logger (`utils/logger.ts`) does a synchronous
`JSON.stringify(context)` and then `console.log` for every line that passes the level check.

**Cost**:
- journald CPU [M]: 547 CPU-s over 27.7 h, an average of **0.006 cores**. That is negligible.
- journald disk [M+I]: the journal is at 2.2 GB (`journalctl --disk-usage`). About 312 MB/h from this one unit means the
  retention for **all** units is on the order of hours [I]. That is a forensics cost, not a CPU cost.
- activity-api CPU for serialization [I]: about 87 KB/s of JSON is roughly 1 ms/s of CPU, so small. The unmeasured risk is
  `console.log` blocking on a slow journald pipe while the host is at loadavg 31. /health latency p90 was 26 s and p99 60 s
  [M], which shows event-loop stalls, but they cannot be attributed to logging from this data.
- The larger cost around these log lines is **what they log**: every INFO `Executing authenticated query` corresponds to a
  full WS connect and authenticate (§0b).
- SurrealDB `--log info` [M]: **3 lines in 10 min**, all `WARN … transaction was dropped without being committed`, emitted at
  the 07:51:44 restart. Surreal's average CPU is 3.04 cores over 27.7 h, and its logging adds nothing measurable.
  **Keep `--log info`.** It is not a cost, and the dropped-transaction warnings are useful.

**Recommended level policy**:
1. SQL text and params never appear at INFO. `surreal.ts:378`, `:395` and `:404` move to DEBUG.
   - Params should never be logged, even at DEBUG. They carry id lists up to 44 KB and possibly user content.
   - Log `sql_hash` (sha1 of the whitespace-normalized SQL, first 12 hex characters) plus the first 120 characters.
2. **Slow-query log** in `SurrealDBClient.query` (where `dbStats.record(sql, ms, ok)` already exists, `surreal.ts:~208`)
   and in both `queryWithAuth` paths, which have no `dbStats` today.
   - Emit WARN when `ms > 100`, with `{sql_hash, sql_head, ms, rows, path: root|jwt}`.
   - Rate-limit to 1 line per hash per 10 s, and include `suppressed_count`.
3. Per-request auth success lines (`jwtAuth.ts:296`, `:493` and `auth-cache.ts:116`) move to DEBUG. Auth **failures** stay at WARN.
4. The access log becomes one line per request (`-->` only). Sample 2xx responses under 1 s at 1%; always log non-2xx and
   anything ≥ 1 s.
5. Errors the handler has already classified as idempotent (`already exists` on duplicate delivery) move to DEBUG. Other
   DB errors log `sql_hash` and error text at ERROR, without params.
6. A real bug surfaced by the ERROR stream: `routes/impulses.ts:1672` `SELECT count(DISTINCT shape_signature)` fails to parse
   on 2.3.3. It failed **54×/10 min** [M]. SurrealQL has no `count(DISTINCT …)`; use
   `array::len(array::distinct(…))` or `GROUP BY`. File it as a gap.

Effect [I]: roughly 52 MB → under 2 MB per 10 min (about 96% less), and 128 → about 5 lines/s.
Risk: the loss of per-query INFO traces that someone might grep today. The slow-query log with `sql_hash` replaces them.
Falsifier: `journalctl -u activity-api --since -10min | wc -c` < 3 MB with the same trace count. The slow-query lines by
hash should show which statement dominates. If the /health p90 does not improve, logging was not the stall.

---

## 5. Summary: effect, files, risk, falsifier

| Fix | Files | Expected DB-load effect | Latency effect | Risk | Falsifier |
|---|---|---|---|---|---|
| 0a Early dedup and no client-vs-server race | `routes/execution-traces.ts` (top of `app.post('/')` `:2357`), `ias-executor-ts/src/adapters/activity-api-trace-sink.ts:317/347` | about −60% of ingest statements | breaks the retry amplification; the largest single lever | low (the idempotent 200 already exists) | distinct/stored ≥ 0.98 |
| 0b Fix pooled `queryWithAuth` (line 384), then enable the pool and add conflict retry to the auth path | `db/surreal.ts:370–420`, `db/auth-session-pool.ts` | −6.5 WS handshakes and JWT authentications per second | removes a 200–300 ms cold handshake per JWT query [S comment] | **high if the pool is enabled before line 384 is fixed** | pooled query returns the same rows as root plus PERMISSIONS on a known query |
| 1 Remove the activity_template UPDATE and dead reads | `routes/execution-traces.ts:2549, 3266, 3331–3439` | −1 to −2 writes and −1 read per trace | small per trace | low | 0 `UPDATE activity_template` |
| 2 CTS deterministic UPSERT, coalescer, retry, fold, UNIQUE index | `routes/execution-traces.ts:2701, 3661, 3750`, `lib/posterior-update.ts:690, 1226`, `routes/activities.ts:11594`, `lib/cluster-posterior.ts` (reuse the slug), new migration | range read-modify-write becomes a batched point write; W4's per-write count scan and concept seed removed | posterior writes leave the request path | medium (the migration fold must ship with the writer change) | Σ Δn_obs / submitted = 1.000; 0 conflict WARNs; 0 duplicate cells |
| 2′ W3 uses the reach verdict | `routes/execution-traces.ts:3740` | none | none | low | re-derived bucket α grows only on `reached` traces |
| 3 Chain probe guard, skip on duplicates, emitter-supplied chain | `routes/execution-traces.ts:1696–1784, 2896`; emitters | about −380 write transactions per 10 min | small | low | ≤ 5 chain UPDATEs/10 min; no rise in empty chains |
| 4 Log-level policy and slow-query log | `db/surreal.ts:378, 395, 404`, `middleware/jwtAuth.ts:296, 493`, `middleware/auth-cache.ts:116`, `index.ts:11`, `db/paradigm.ts:451` | none | possible event-loop relief (unmeasured) | low | < 3 MB per 10 min |
| 4′ `count(DISTINCT)` parse error | `routes/impulses.ts:1672` | −54 failed queries per 10 min | none | low | 0 parse errors |

Under law 6, each fix also names the detector that should have caught it:
- a delivery-multiplicity monitor (distinct/stored);
- a test that exercises the pooled `queryWithAuth` branch;
- the CTS conservation check (Σ Δn = submitted);
- a detector for "no reader" on writes such as the activity_template counters (the `hollow_write` class).

## What was not measured
- The number of root-path CTS conflicts that were retried. Retries are silent: `dbStats` counts are not exposed in the logs,
  and no SurrealDB-side statement stats were read.
- The number of existing duplicate CTS cells today. That needs a GROUP BY scan, deferred to after the graded run.
- The real per-handshake cost of the legacy JWT connect on this instance.
- Whether `console.log` blocks the event loop under journald backpressure.
- The `activity_template` index list (the INFO output was truncated in my print), so whether it carries an FTS index that
  writes would invalidate was not confirmed. Moot while the table is empty.
- Which tables the composition-chain readers use (AET versus `execution`).
