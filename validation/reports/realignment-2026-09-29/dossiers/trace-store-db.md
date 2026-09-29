# Dossier: trace-store-db

**One line:** the persistence layer under the learning loop (SurrealDB 2.3.3: the `execution` trace store,
its views, its migration ledger and its retention) has been repaired about 90 times since March. Every
repair fixed one instance. The class keeps coming back because nothing in the system compares what the
store is declared to be with what it actually is. Readers, detectors and the migration ledger all take
intent (the ledger row, the row counter, `status:"OK"`) as if it were state.

Sources: `classes/trace-store-db.json` (87 attempts, 44 problems, 10 claims), raw notes (`git-activityapi`,
`git-super-2`, `git-devvessel-1`, `git-deployment`, `git-mid`, `git-goalhost`, `memory-1/3/adjacent`,
`live-gaps`, `live-resolvers`, `live-activities`, `live-pool-memory`, `node2-runtime`, `docs-3`,
`concept-db-db`), `_mech_chunks`. Live verification was done on 2026-09-29 04:49–04:56Z against
`substrate-live` (hub, standalone) and `compose2-live` (node 2). All queries were read-only.

The class is several sub-families that share one seam:

| Sub-family | Share of records |
|---|---|
| **G** growth, retention and storage (rows, blobs, OOM) | about 45% |
| **M** migration ledger vs actual schema | about 20% |
| **Q** SurrealDB returns plausible wrong answers (planner and typing traps, NULL≠NONE, absent = empty) | about 20% |
| **R** the immune system restarts the DB-pressure victim | about 5% |
| **I** ingest idempotency (retries re-sending committed traces) | about 5% |
| **T** untraced producers (shell, self-development pipeline, failed walks) | about 5% |

---

## 1. Timeline

Claims of "fixed" or "first" are marked **CLAIM**. The **LATER** entries show what happened afterwards.

| Date | Event (source / hash) | Later |
|---|---|---|
| 03-01..05-27 | At least 12 separate SurrealDB typing and coercion fixes (datetime, org_id, record-id): `555b1b9a`, `5cd1da38`, `839e1e46`, `72c041b3`, `afe2de86`, `e5cf2897`, `4052bdd9` (git-super-1). | The same typing class returned as NULL≠NONE (08-21, `2a31d5a`) and `array::len(NONE)` (09-22, `41c9e89`). |
| 05-18 | SurrealDB RL layer openspec: `fn::beta_sample` went live, but `RELATE composes` was never created and HNSW was dropped by migration 110 after a CPU storm. | Partial. |
| 05-24..25 | F-031..F-065: the JWT_SECRET container death, the seeder race that wrote org_id NONE on all 13 template writes, and a Redis template cache with infinite TTL. `b1d14073` self-bootstrap fixed F-044 but introduced F-049. | |
| 05-31 | `d915bc0` capped scan limits because of SurrealDB thrash (dev-vessel). | |
| 06-15 | The operator deleted 46,543 validator-dispatch rows (all failures, template_id NONE). GET latency went from 5.3 s to 3.0 s. | Re-bloated to 110K by 06-16. |
| 06-16 | Stratified `trace-retention.ts` sweep built, container-only and uncommitted. | |
| 06-17 | ias `09c32a0` added bounded retry on trace POST. | This became the duplicate-delivery source: 63% duplicates on 09-25, fixed in `3cf29a3` on 09-26. |
| 06-21 | Pruned from 265,045 to 160,443 rows; `TRACE_RETENTION_ENABLED=true` set in gen-env (`ae447b449`). **CLAIM:** "The flooders can no longer re-bloat the store." | **LATER:** 220K rows on 07-08 with 0 deleted per cycle (GROUP BY deadlock); 267K on 08-08. |
| 07-08 | Self-managed reconciliation: `3f378ae` (migration 156 counters, db-admin), dev-vessel `9674cb8` (maintenanceLease, trace_store_health_observer, reconcile). Moved AET from 218,953 to 40,851 rows; cold query from 86 s to 4.4 ms. | **LATER:** "could never run" until 08-09 (`5dcfc60`, `af12cf3` "my own fix was still broken"). Meanwhile the store sat at 2× cap (`3a6018f`). |
| 07-08 | Trace-digest read-swap added a new `activity_execution_trace_digest` table. | Redundant: `trace_digest` already existed. Dead code. |
| 07-14 | AET → `execution` migration (`848e7e1`..`9d46962`, `27dca9b` root write plus verify-after-insert, after a silent PERMISSIONS drop). 48 = 48 rows, 0 drops. | Worked. But `DUAL_WRITE_ENABLED=false` lives in env, and AET is a fossil (18,135 rows, all July, verified live 09-29). Eight self-observation scripts read the frozen AET for 42 days (`3c1bf965`, 08-25). |
| 07-16 | `2687fbe7` RocksDB block-cache cap ("NOT a full fix") and `dbaf0cf3` restart. | OOM came faster. Net negative. |
| 07-22 | cgroup MemoryHigh 22G / Max 26G; migration 162 index; `6eda182a` 150k cap plus valve (`b048ece`, set only in live env). Reconcile livelock broken (`2181e96`, `07f2bbe`, `b02d789`). A sort-spill via `SURREAL_TEMPORARY_DIRECTORY` did nothing (2.3.3 does not spill). | Kills fell to about 0/hr. **LATER:** wedge at MemoryHigh on 07-31 (`60b2328e`). |
| 07-23 | Dead view/table retirement (migrations 165, 167, 171–179): tables went from 102 to 94. | The hidden view re-creator was never found. 100 tables live on 09-29, and `v_shape_pattern_performance` still exists (0 rows). |
| 07-24 | Template-list cache thrash `a4735e9`: CPU 1955% → 1570%. | The inverse (never invalidated, 6 days stale) was fixed on 09-24. |
| 07-26 | **CLAIM** (substrate-utils topology note): "Retention is ON and enforcing at cap 150k". | **LATER:** 08-08, 267,491 rows, "configured but NOT enforcing", `upkeep_stats` empty. `upkeep_stats` still has **0 rows** (live 09-29). |
| 07-29 | identity `bfad5ca`: key_session reaper. 1.34M rows, 99.4% expired. | Worked. |
| 08-02 | Migration timeout raised to 300 s (`c0246f7`). Caused a hub restart loop and ribosome blindness for about 2.5 h. | Reverted `8fbc032`. |
| 08-03 | Six schema files never applied (`a5aed3e`, `99424ad`, …). FTS index cannot build inside the startup gate (`20d8d26`, `e5a8fd5`). | 040 and 045 were still broken. On 09-24 they were refiled as time-out-on-every-start gaps (open). |
| 08-04 | `b4d7b0e`: the migration runner marked pending migrations applied without running them (a failed ledger read returned an empty Set; 188 was lost). | **LATER:** 09-05, the fresh-DB bulk path marked 37 migrations applied in 1 s. |
| 08-08 | `0b3f70b2`: self-recovery probe made representative. Execution table 18 GB. | The probe could only see a *dead* DB: 16 restarts in 6 h. |
| 08-09 | Valve experiments. Dropping `idx_execution_id` (193) made deletes 5× slower and was reverted (194). batch=1 (`dd32641`) was reverted (`f4d62bf`). Deletes cost 3.5–17 s/row. **CLAIM:** "trace store is down". | **LATER:** retracted; it had hung under contention. |
| 08-10 | Compose storm masked (load 45 → 1.8). **CLAIM:** "local activity-api is the spoke's only reachable trace store". | **LATER:** round6 found the fleet uses the hub; the claim was wrong. |
| 08-12 | Export/import rebuild to reclaim blobs. | Failed: `ok=3 fail=6`. The 425 July blob files are still present (live 09-29). |
| 08-16 | Retention saga. Phase-lock deferral (`d253457`) hypothesis refuted. batch=1 via gen-env (`a78fcfd7`) left 320 in flight with p50 33.7 s and was reverted (`07e32d38`). Poison head rows found (`9e8b931f`), leading to quarantine-and-advance. `afed9094`: a DB restart alone took CPU from 607% to 0. SurrealDB was unmasked after being masked since the 08-12 OOM. | 25 rows per 6 min against a surplus of 310k. Store at 460k vs the 150k cap. |
| 08-17 | `ef83e6a`: two migrations had failed on every boot for 8 months. `e2ba1a69` → `9df01220`: a memory cap computed on the workstation OOM-killed the hub DB. | |
| 08-21 | `2a31d5a`: NULL is not NONE. Omit absent keys, then read back. | Worked for that site. The class recurred 11 times (git-activityapi). |
| 08-22 | Migrations 196–199: corrupt `success` composite indexes rebuilt, then removed. The ring drained 150k → 9,242 (and 150,002 → 5,669 auth rows). "Substrate self-fixed". **CLAIM:** rebuilt corrupt indexes. | **LATER:** the `init_migrations` UNIQUE index still admits a duplicate `158` row (verified live 09-29: 225 rows, 224 distinct). |
| 08-29 | Socket leak `4e28073` and `c601cd6`. **CLAIM:** "fully back under control". | **LATER** the same day (19:01): a second driver, 29 concurrent `bun test`. |
| 08-29 | Self-development pipeline emits traces (`4afd4c1`, `e8e3fec`, `c5f7efb`). | Still untraced: gap_to_feature, apply_proposal_as_patch, patch_with_tools. |
| 09-03 | GROUP ALL drops an equality conjunct beside a datetime range. `82b030e` fixed only the alias. | The planner defect remains. |
| 09-05 | Migrations 205/206/210: 205 landed unparseable, then made 6 fields non-optional and broke every write (206), and 210 was "not SurrealDB". | |
| 09-16 | `c0b9624` and `3cafd9c` byte ceiling. **CLAIM:** "landed and working". **CLAIM:** "retention sweep hung; nothing is burning". | **LATER:** the sweep finished after 19.7 min at 511% CPU. The byte bound has never bound: live 09-29 still shows `boundBy:"rows"`, `meanRowBytes 685`. `ad9da780` bounded the recovery ladder after 36 byte-identical escalations. |
| 09-17 | **CLAIM:** "retention duty cycle starves dispatch" (gap-mu4pb4p3). | **LATER:** retracted. It drained on its own ("would have manufactured causal evidence"). |
| 09-20 | Migration 023 hand-applied (never in the ledger); migration 211 records state_signature. | Worked. The ledger now carries two different 211 filenames (live). |
| 09-22 | Fresh-datastore trace writes returned 500. Reader-less views 023/045/055 poisoned every insert on cold boot. Substrate-landed fixes `50946be`, `291b72d`, `41c9e89` via hand-staged evaluate/cutover; the fresh-volume acceptance passed. `129fa76` filed "cold boot silently skips twenty-two unparseable migration files". `07a6c7c`: failed walks now write a trace. | The skip gap **is still open** (plus 4 recommit/narrowed clones). About 09-22 07:01, `v_paradigm_execution_traces` vanished. |
| 09-23..24 | Trace-store reconcile remedy loop. `62e174a` and `2fd1dca` **failed** behavioural verification. The remedy was dispatched 47 times in 6 h. Four hand-made variants were minted (lease-ttl-120s, release-before-verify, swap-timeout-15min). The reconcile held the single global change window, and 39% of verified landings were discarded. `fdb2fa6` (autonomous): migrations that time out are rerun in the blocking start path. | Decided **518 times** from 09-24 to 09-28 (767 dispatches on 09-28 alone). Expectation calibration shows `trace_store_reconciliation 400 attempts / 0 lands`. |
| 09-25 | Trace-write storm. 1064 POSTs and 1194 duplicate-id errors per 5 min, load ~31. Substrate-authored fixes: `b56623a` dup-check first (p50 51 s → 2 ms), **`9387ca7` removes the 30-min FTS REBUILD** (about 89% of 41 GB of blob garbage; it occupied the DB ≥6.6 h/day), `bf3f0bf` in-process dense scoring. **CLAIM (this session, 09:53Z):** "The machine is fixed; four activity-api fixes live." | **LATER:** the store grew ~1.5 GB/h on 09-26, retention deletes timed out again on 09-26/27, and the DB used 12 cores at 03:08 on 09-27. The 42 GB blob gap has sat open on `operator_hold` since 09-26. |
| 09-25 | `429c8bd`: quadratic `unaccounted_landing_scan` made linear (13 s → 0.03 s). | Worked. |
| 09-26 | ias `3cf29a3`: 120 s timeout plus Idempotency-Key. | Outcome unverified. The 11,716-file spool was not addressed. |
| 09-28 | `1f0d70f` restores `v_paradigm_execution_traces`; `d98309e` makes 212 IF NOT EXISTS. Every trace-listing detector had seen `traces_examined 0` since about 09-22. Substrate `b8671c9` changes the listing to read `execution` directly. The operator reverted it (`23abbf4`, 06:59 -0700) and reapplied it 30 s later (`89f04fb`: "my revert was wrong"). | **LATER (live, 09-29):** the ledger says `212-restore-vpet-view.surql` was applied at 09-28T11:59Z. The object is now a plain `DEFINE TABLE … SCHEMALESS` (no `AS SELECT`) holding **2 rows**, both from 09-28 13:37Z. **Six live readers still query it** (see §4). |

---

## 2. Root causes

1. **The migration ledger records intent, not state.** `init_migrations` records that a file ran, not that
   its objects exist. Nothing reconciles the ledger with `INFO FOR DB`, and `IF NOT EXISTS` turns a
   repair into a no-op once any object of that name exists. The applier ran in `ExecStartPre=-`, so its
   failures were discarded. It also marked migrations applied on a failed read (`b4d7b0e`, then again on
   09-05). The ledger is shared across vessels and holds duplicate numbers (15 collisions), ghost names
   (143, 159) and a UNIQUE index that does not enforce. Git-activityapi states it directly: "Nothing in the
   codebase reconciles the ledger against the schema."
2. **Absence and failure look like healthy emptiness.** In SurrealDB a missing table reads the same as an
   empty one. `query()` does not check per-statement status; `queryRaw` (`676c3f3`) is used at one call
   site only. Planner traps (composite-index subsets, an equality dropped beside a datetime range,
   GROUP ALL, KNN plus filter, NULL≠NONE) return *plausible* numbers. Detectors therefore report zeros or
   "clean": `traces_examined 0` for 6 days; `v_activity_score` absent on every deployment; AET read for 42
   days after it froze.
3. **Nothing decides what is worth storing, and the retention policy is env-gated.** Ticks, auth checks and
   validator fires are written as `execution` rows. On 09-29 over the last 24 h: validator-dispatch 5,540,
   gap-to-scenario-bridge-tick 4,038, auth_resolve_v1 2,526, mitosis-tick 1,395 and slot-binding 1,127,
   together **69% of 21,343**. Cap, ceiling and exemption list are `TRACE_STORE_CAP`,
   `TRACE_RETENTION_*` and `TRACE_RETENTION_ACTIVITIES` env vars (`trace-retention.ts:158,252`), a law 1
   violation. Growth is bounded by deleting learning history instead of by not admitting telemetry.
4. **Storage-engine costs are invisible to every health instrument.** Blob GC is off in 2.3.3 and there is
   no knob for it, so deletes never reclaim disk. There are 16 indexes and min/max views are recomputed
   per delete. The health observer, `trace-store-health-check.ts` and the counter all count *rows*. The
   30-min FTS REBUILD wrote most of 41 GB before anyone looked at bytes on disk.
5. **The remedy loop has a threshold at its own set point.** Retention holds the table at exactly
   `ceiling = cap = 150,000`. The observer fires when `row_count > cap`. Any tick between sweeps therefore
   re-arms `trace-store-reconcile-2026-09-24T11` (open; its summary on 09-29 04:49Z reads
   "row_count=150099 exceeds cap=150000"). The remedy fails about 84% of the time (below), holds the
   global lease, and has no success condition it can reach.
6. **The immune system treats the DB-pressure victim as the fault** (R4: 6 fixes, 07-10..09-16). Probes
   could see only a dead DB, so restarts added load.
7. **Non-idempotent ingest.** A client timeout (15 s) below the server p99 plus retries caused duplicate
   delivery (63%) and write storms.
8. **Producers that write no trace** (T): shell requests (2,545/2,545 with no execution_id on 09-28),
   the self-development pipeline before 08-29, and failed walks before 09-22. The trace store cannot
   carry the evidence of the landings that change it.

## 3. Why it recurs

Every instance was fixed at its own site, and each fix installed a new *instrument* (row counter,
UNIQUE ledger, health observer, byte ceiling, IF NOT EXISTS, quarantine valve). None of those
instruments checks the thing it names against observed reality. As a result:

- the next deviation arrives through an unwatched axis: rows → bytes → blobs → views → ledger →
  index corruption → idempotency;
- the instrument itself reports health: `upkeep_stats` has 0 rows; `boundBy:"rows"` forever; the 158
  duplicate sits under a UNIQUE index; 212 is ledgered but the object is not a view;
- a remedy re-dispatches forever against a threshold that equals the set point.

The missing piece is not another detector. It is **the store's self-model**: a declared expectation for
every persistent object, reconciled continuously against the store and exposed as shaped impulses. The
same fact then drives the detectors, the retention policy and the migration applier, so no second copy of
it has to be kept in step. The raw notes named it three times without building it: "a ledger-vs-schema
reconciler (INFO FOR TABLE/DB versus the expected DEFINEs)" and "status-checking in `query()` is the one
fix that closes the write-read-mismatch class at its seam" (git-activityapi); "the remaining lever is …
partitioning … or not storing this volume" (`07e32d38`).

Under the user's operating model, this is the "same reason" recurrence: the walk routes around the hole
(for example, the listing now reads `execution` directly) but the capability is never encapsulated. The
next reader of the same frozen object hits the same hole.

## 4. Shared capability that would retire the class

**Name:** *declared-vs-observed store reconciliation* (`storeExpectation` / `storeObservation` shapes),
at the **activity-api persistence seam**: `src/db/surreal.ts` `query()`, `scripts/init-database.ts`, and
`services/trace-retention.ts`. It runs as a leased activity that dev-vessel can grade. Its parts:

1. **Object expectations.** For every table and view that code reads, record: that it exists, its kind
   (view `AS SELECT` vs plain table), its fields, its expected freshness (newest row age), and its row or
   byte budget. The expectations are derived from the migration files plus a reader grep, not typed by
   hand.
2. **Observation.** Read `INFO FOR DB/TABLE`, freshness probes, bytes on disk (live vs blob), and
   per-producer insert rates. Write them as impulses. The ledger then becomes a cache of what was
   observed, not the authority.
3. **A status-checked query boundary.** `query()` fails loudly on a statement error or on an unknown
   table. Every aggregate a detector reports carries an impossible-predicate control.
4. **Admission and retention as shapes.** Whether a producer's fires are stored as `execution`, sampled,
   or rolled into a counter is a shaped policy read at use time. It is not an env list.
5. **A remedy with a reachable success condition.** Hysteresis, so the observer fires above cap×(1+ε).
   The success predicate is measured from the observation, not from the process exit.

### Prior attempts at this same capability, and why each did not hold

| Attempt | What it was | Why it did not hold |
|---|---|---|
| `trace_store_health_observer` (`9674cb8`, 07-08) plus `trace-store-health-check.ts` | Size self-model for one table | Checks only `row_count` against cap. Blind to blobs and whole-table rewrites (open gap `the-trace-store-health-observer-counts-execution-rows-and-cannot-see-blob-garbage…`). Could not run 07-08..08-09. Threshold equals the set point, hence the 518-decision remedy livelock. |
| `trace_store_counters` O(1) counter (migration 156) | Observed row count without a scan | Fire-and-forget increments miss delete paths: drift 21% (07-12), under-report 44% (08-10). Holds exact at present (150,099 vs `count()` 150,100), but it models rows only. |
| `init_migrations` ledger with UNIQUE, the `b4d7b0e` / `3a08e00` / `fe0eaf9` fixes, `129fa76`, `fdb2fa6` | Schema-state record | Records intent. The UNIQUE index does not enforce (158 ×2, live). Ghost names. 22 files skipped silently on cold boot (gap open since 09-22). 212 ledgered while the object is not a view (live). |
| `d98309e` 212 `IF NOT EXISTS` (09-28) | Idempotent re-create of a missing view | IF NOT EXISTS checks the *name*, not the definition, so a plain table of that name satisfies it. By 09-29 the object is a schemaless table with 2 rows. |
| `upkeep_stats` (retention upkeep record) | Retention reports what it did | 0 rows (live, 09-29). Nothing writes it back or reads it. |
| Byte ceiling `c0b9624` / `3cafd9c` (09-16) | Budget on bytes, not rows | Estimates bytes from the mean row size (685 B), not from disk. `boundBy:"rows"` in every run. Disk bytes live in blobs the rows do not count. |
| `db-maintenance` and the slow-query detector | DB health | Detect-only. Names a remedy template that does not exist (`db_performance_slow_queries`, 118 failed attempts). |
| Self-recovery `db_under_pressure` probe (`fc143654`, `0b3f70b2`, `ad9da780`) | Observe DB pressure | Sees only a dead DB. Restarts the victim. Bounded, but still not a model of the store. |
| `queryRaw` status check (`676c3f3`), `e5a8fd5` (FTS silent zero), `5c57ff9` write-key reader test | Loud failure at the query boundary | Applied at one call site each. `query()` still swallows status (git-activityapi, 09-29 mech chunk). |
| `db-friction observer` (`f3f5fc51`) and `trace-retention` global valve with quarantine | Observe delete friction and advance past poison | Quarantine hides the failure rate. Live 09-29 04:41–04:43Z: 6 of 7 batches FAILED, 150 rows quarantined, and the run still reported `removed:433, remaining:0`. 608 fail, timeout or quarantine lines in 24 h. |
| `TRACE_RETENTION_ACTIVITIES` exemptions plus the 150k cap | Admission policy | Env-gated (law 1). Exempts validator-dispatch from *deletion* rather than from *admission*. Telemetry evicts learning traces, so the window is 5 days. |
| Export/import rebuild (08-12); proposed surrealdb_export/import + backend-snapshot-to-git primitives (06-03) | Reclaim, and a durable schema/state snapshot | Rebuild failed 3/9. The primitives stayed dormant (0 traces). |

## 5. Current verified state (2026-09-29 ~04:50Z)

**Hub (`substrate-live`, live code `/vessels/activity-api`, clone at `39783b0`, 09-28 21:54Z):**

- **Execution store**
  - `trace_store_counters:execution`: row_count 150,099, cap 150,000, last_reconciled 04:44:32Z.
    `count()` gives 150,100.
  - Retained window: 106 rows older than 6 days, 706 older than 5 days, 36,613 older than 4 days. The
    effective learning window is **about 5 days**.
  - Last 24 h: 21,343 rows. 69% are telemetry and ticks (validator-dispatch 5,540, bridge-tick 4,038,
    auth_resolve_v1 2,526, mitosis-tick 1,395, slot-binding 1,127).
  - `math::min/max(executed_at) … GROUP ALL` returns **null** on this table. This is the silent-wrong
    class, still live.
- **Retention run 04:40:59–04:44:00Z**
  - Counted 150,433; target 433.
  - 7 batches of 25; batches 0–4 and 6 FAILED with a "query was not executed" timeout. 150 rows
    quarantined, 6 quarantine failures.
  - Reported `removed:433 remaining:0` and `boundBy:"rows"`. Orphan content reap: `reaped:0`.
  - `execution_trace_content` holds **510,307** rows against 150k executions (content outlives its
    execution).
  - `upkeep_stats` has **0** rows.
- **Disk**
  - `/var/lib/surrealdb/data.db` is **45 G**, up from 42 G on 09-25 and 41 G then.
  - 697 `.blob` files, 425 of them still dated July.
  - `enable_blob_garbage_collection=false`.
- **Trace view**
  - `v_paradigm_execution_traces` is `DEFINE TABLE … TYPE ANY SCHEMALESS` (no view), with **2 rows**
    (09-28 13:37Z). The ledger shows `212-restore-vpet-view.surql` applied 09-28T11:59:38Z.
  - Live readers still `FROM v_paradigm_execution_traces`: `src/lib/posterior-update.ts:800` (posterior
    update), `src/routes/grouped-execution-stats.ts:143,144,234` (per-activity stats and failure-mode
    counts), and `src/routes/execution-traces.ts:1642,2231` (composition chains). The 09-28 fix redirected
    only the listing (line 1059).
  - **The same absent = empty class is live again one day after it was declared fixed.**
- **Ledger**
  - `init_migrations`: 225 rows, 224 distinct; `158-extend-paradigm-exec-view.surql` appears twice under a
    UNIQUE index.
  - Two different `211-*` names.
  - `v_shape_pattern_performance` still exists (0 rows) after its REMOVE migration.
  - 100 tables in total.
  - `ExecStartPre=-…init-database.ts` is still the unit (failures discarded).
- **Fossils**: `activity_execution_traces` has 18,135 rows, all from July.
- **Remedy loop**
  - `development-vessel:trace-store-reconcile` and its variants: **120 executions in 24 h, 19 successful**
    (base 12/42; lease-ttl-120s 5/43; release-before-verify 2/32; swap-timeout-15min 0/1;
    learned-activity 0/2).
  - Gap `trace-store-reconcile-2026-09-24T11` is open with `falsifier:none`, re-armed at 04:49Z.
- **Open gaps in this class (live gap store, 6,279 rows)**
  - 42 GB blobs (`operator_hold`); 30-min FTS rebuild. That one is still open although `9387ca7`
    removed the rebuild, so the store did not register the closure.
  - Retention removes 6% of ingest (×2); env-steered retention (×2 plus a recommit).
  - The observer is blind to blobs; the 22-file cold-boot skip (plus 4 clones); migrations 007, 040 and
    045 fail on every start; ExecStartPre blocking (×2); reconcile lease (×2); the reconcile pins its
    base template id.
  - `cluster_shadow_decision` impulses of 70–100 KB that never expire. The `impulse` table holds 107,865
    rows (concept-db-db), outside both retention sweeps.

**Node 2 (`compose2-live`):** `surrealdb` and `activity-api` are inactive and `activity-api` is masked.
Node 2 has no local trace store, so its executions resolve to the hub. This is correct for the spoke
profile. But its `learning-loop-selftest`, `validator-liveness`, `joint-liveness` and `compose-drift`
units were failed at census time (live-activities), because those checks assume a local store. A
reconciler must address the store by shape through discovery, not by `localhost`.

**Repo drift note:** the super-repo pointer `repos/activity-api` is at `41c9e89` (09-22). The live clone
is at `39783b0` (09-28). Readings taken from the super-repo checkout are 6 days stale.

## 6. What to keep (encapsulated pieces that earned it)

- The `execution` table as the sole trace store (07-14 migration, verify-after-insert `27dca9b`).
- `b56623a` (duplicate check first), `9387ca7` (no scheduled FTS rebuild) and `bf3f0bf` (in-process
  dense scoring). These are substrate-authored and each fixed a root cause.
- The `trace_store_counters` O(1) counter (currently exact) and the named maintenance leases.
- Migrations 198/199 (no indexes over boolean `success`); `2a31d5a` (NONE-omit plus read-back);
  `429c8bd`; `07a6c7c` (failed walks traced).
- The retention *mechanism* (stratified sweep plus valve). Its policy inputs should be converted from
  env to shapes.

Retire or fossil: AET, `activity_execution_trace_digest`, the empty `v_shape_pattern_performance`, the
dead `v_paradigm_execution_traces` object (after its six readers are repointed), the three hand-made
reconcile variants, and the `db_performance_slow_queries` phantom remedy.

## 7. Retire condition (measurable, checked continuously on every node that serves the shape)

The class is retired when a reconciler activity (not an operator) has held all of the following for
**14 consecutive days on the hub**, with no new gap in this class filed under a different id for **30
days**:

1. **Schema = expectation.** For every object read in activity-api `src/`, `INFO FOR DB` matches the
   declared kind (view vs table) and fields, and freshness is within budget. For
   `v_paradigm_execution_traces` or its replacement, the newest row is less than 1 h older than the newest
   `execution` row, or it has zero readers. The ledger carries no duplicate or ghost filenames. **Positive
   control:** on a scratch server, dropping or replacing a view is detected within one cycle and filed
   with an edit site.
2. **No silent zeros.** `query()` rejects statement errors and unknown tables at the seam, measured as 0
   call sites that bypass it. Every detector aggregate carries an impossible-predicate control.
3. **Bytes, not rows.** On-disk bytes ≤ 3× logical bytes. Today it is 45 G on disk against an export of
   about 1.5 GB (the 09-25 note), which is >10×. The number comes from the reconciler's own disk
   observation.
4. **Retention works without quarantine.** Valve batch failure rate < 1% per day. Today 6 of 7 batches
   fail per run and there are 608 fail lines in 24 h. `upkeep_stats` (or its replacement shape) holds one
   row per sweep. Orphan `execution_trace_content` is 0 older than 1 h.
5. **A learning window, not a telemetry window.** Telemetry and tick producers are ≤ 20% of `execution`
   inserts (today 69%). They are decided by a shaped admission policy (0 `TRACE_RETENTION_*` or
   `TRACE_STORE_CAP` env reads in behaviour paths). Non-telemetry traces are retained ≥ 14 days (today
   about 5).
6. **The remedy converges.** `trace-store-reconcile` (or its successor) is dispatched ≤ 1/day, with
   success ≥ 80% measured by its own post-condition. Today it runs 120 times a day with 19 successes.
   The observer has hysteresis, so there is no open gap whose summary is "150,099 > 150,000".
