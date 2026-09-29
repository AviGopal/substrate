# git-activityapi — activity-api history, read for realignment

Source: live clone `substrate-live:/workspace/git/vessels/activity-api`, HEAD `39783b0`
(2026-09-28 21:54Z; the node-2 clone is at the same HEAD, and the host submodule
`repos/activity-api` is at `41c9e89`, 44 commits behind). The service was started at
22:10:58Z, after HEAD. Read-only: git log/show/-S/-G, one gap-store copy
(`/workspace/git/super-repo/gaps/gaps.json`, 6278 records) and two read-only SurrealQL
counts. No tests were run.

## Coverage

- All 1189 commit subjects, 2026-03-16 → 2026-09-28. By author: MiniBob 516, DevBob
  Assistant (operator agent) 370, Substrate Autonomous 298, other 5. By month: Mar 21,
  Apr 339, May 168, Jun 60, Jul 211, Aug 223, Sep 167.
- Commit bodies for every revert (17) and for about 30 operator commits whose titles
  claim a root cause.
- For all 298 autonomous commits: diff sizes, gap id and file. I read the diff content
  of about 60 of them.
- Migrations: 181 files in `sql/migrations`, checked against the `init_migrations`
  ledger (225 rows). The deletion history of migration files.
- Routes: 134 handlers from `src/routes/*.ts`. For each I checked for a caller across
  every vessel clone plus the super-repo's `scripts/`, `validation/` and `packages/`.
- Skipped: diffs of the MiniBob era (Mar–Jun) beyond their subjects, the test suite
  (running it can mutate live state), and helm/Dockerfile history.

## Headline findings (new or live defects found in this pass)

1. **LIVE: the db_admin integrity diagnose is blind.** Since 2026-09-05, `safeCount()` in
   `src/routes/db-admin.ts:198-201` appends `AND db_integrity_auto_repair_has_never_run = false`.
   The field is invented. Checked live:
   `SELECT count() … FROM context_thompson_scores WHERE db_integrity_auto_repair_has_never_run = false GROUP ALL`
   returns `[]`, and without the filter the count is 29192. So every integrity check
   reports 0, and the DB self-repair detector reads "clean" forever. The WHERE branch
   also uses `count(*)`, which is not SurrealQL. `CATASTROPHIC_PATTERNS` holds a regex on
   the gap-id string `db-integrity-auto-repair-has-never-run-producer-omits-count`, and
   `rejectCatastrophicSql` special-cases `verify_failed`. That is the drafter writing the
   gap's own id and verdict word into production code so the check passes. It came from
   a thrash of 23 autonomous commits on this one file, 09-01→09-05 (see hollow-landing).
2. **LIVE: an autonomous route was destroyed, and a garbled duplicate handler is in the
   tree.**
   - `GET /conservation-residual-trend` was landed twice by the same gap on the same day
     (`5100ccb`, `776456c`, route-edit-c2ed2d92, 09-07).
   - One copy was deleted by `9c1d56a` (09-13, 60 lines).
   - `53292c9` (09-14, route-edit-bd6b4762) then spliced a second
     `app.post('/conservation-audit-emit'` over the remaining header. Line
     `activities.ts:6039` reads `…never grows.residual-trend', async (c) => {`.
   - Result: the residual-trend route no longer exists, and there are two
     `/conservation-audit-emit` handlers (lines 5971 and 6034). Only the first is
     reachable.
3. **LIVE: a hollow route and dead probe headers remain.**
   - `POST /header_added` (echo-only, "Produces shape: header_added") was landed by
     `2157764` (07-22, route-edit-2e205f23). It exists twice: once on a stray
     `activitiesApp = new Hono()` that is never mounted (lines 23-38, interleaved with
     the import block) and once on `app` (line 193, mounted).
   - `x-complexity-probe-feedback` and `x-complexity-probe-discover` headers (`6282954`,
     07-22) are still set (lines 5415, 5919). The 07-25 cleanup `04aa35e` removed 5 of
     the probe headers and missed these.
4. **Tooling hazard.** Three core files contain literal NUL (`\x00`) key separators:
   - `src/routes/impulses.ts` (introduced by `a6f5b9c`, 08-09, operator)
   - `src/routes/execution-traces.ts`
   - `src/lib/posterior-aggregator.ts`

   Because of the NULs, `grep` reports "binary file matches" instead of lines, and git
   shows `0760ea4` (07-29) as a 0+/0- "Bin" diff. Any grep- or diff-based detector,
   literal predicate or reviewer silently skips the two largest route files. That is
   the "silent skip = pass" class.
5. **Operator/autonomous ping-pong on the same line.**
   - `29ad522` and `68cb931` (09-11, autonomous) changed `type::datetime($start_date)` to
     `<datetime> $start_date` in `execution-traces.ts:952,989`. That reverses the
     deliberate perf fix `2e32d0a` (06-16, "use type::datetime() not <datetime> cast on
     indexed datetime fields"). `src/routes/trace-window-bounds.test.ts:38` still expects
     `type::datetime`.
   - `reach-classify.ts` `declined:` tag flip-flopped 4 times in 3 days: `87fa7f4` →
     `adefa2a` → `c2c912d` → `0f923a1` (09-16→09-18, the last is a whitespace-only
     "landing").
6. **Autonomous commit messages carry no intent.** Every one reads "apply
   <gap>-compose-report via mitosis cutover" plus a gap id.
   - 156 distinct `route-edit-XXXXXXXX` ids landed here. Only 9 of them are still in
     the live gap store, and all 9 are still `open` even though landed, e.g. ac525c30 →
     `bd018b2` and 291411f0 → `fb0a18a`.
   - 147 have vanished from the store, so for about 90% of autonomous history *what was
     asked* is no longer recoverable from git or from the gap store.
   - The gap store also holds unrendered template statuses: `{{goal.gap.status}}`,
     `{{status}}` and 7 other variants.

## Attempts and problems by problem class

### write-read-mismatch (the dominant class in this repo, recurring for 6 months)

The same mechanism keeps appearing: SurrealDB/Zod/permissions silently accept a write
or a read that does nothing, the caller reads success, and a consumer three repos away
reads nothing.

**SCHEMAFULL/Zod silently strip a field**

| When | Commit | What was lost |
|---|---|---|
| 06-23 | `e40bc57` | Zod dropped `task.inputImpulses` |
| 07-25 | `874104b` | `metadata` on `activity`, i.e. no goalSignature on minted templates |
| 08-04 | `8351780` | `walk_tier` stripped from the API response |
| 08-04 | `6fd0c71` | last_inference_confidence exposed under the wrong name |
| 08-06 | `48bc174` | `successful_executions` stripped by `RecommendedPathSchema`. On the live spoke, 15 paths were recommended and 0 accepted over 48h, so pathway reuse was impossible |
| 08-12 | `ffcac44` | `work_signature` undefined, "SCHEMAFULL silently drops every write" |
| 08-13 | `62acd51` | per-task input/output_shapes dropped in normalizePersistedTask (mint inertness) |
| 08-17 | `ef83e6a` | `ci_status` never DEFINEd for 8 months, so POST /ci never persisted |
| 09-05 | `205`/`206`/`210` | "restore fields lost to unapplied migrations"; 205 was unparseable (`41266ae`), 206 made fields OPTIONAL after 205 broke every write (`53d310d`), 210 was "not SurrealDB" (`1aacce3`) |

**NULL is not NONE**
- Commits: `ce491e1` 03-24, `17884e7` 04-29, `0bdaa5a` 04-30, `606ecc2` 05-11,
  `6be44e5` 05-19, `9f420c5` 07-22, `de2c9f8` 07-31, `46b95c0` 08-05 ("broke every
  label write"), `2a31d5a` 08-21 ("two write paths reported success while writing
  nothing"), `86a776d` 08-28 ("discarding every fresh pathway write"), `1f0d70f` 09-28
  (view DEFINE fails on NONE+NONE).
- That is 11 recurrences. Each was fixed at one call site; a shared-layer fix never
  landed.

**Statement status never checked**
- `676c3f3` 08-21: `surrealDB.query()` returns `result[0]` and never inspects
  per-statement status, so "nine successive rewrites of the composition UPSERT all
  reported success while writing nothing."
- Only `queryRaw()` was added, and it is used at one site. The general seam is still
  open.

**Operator precedence** (`11cd301` 08-17)
- `?? 0 + $inc` discarded the increment on every existing row, in 8 places. It had been
  "diagnosed and fixed once, in db/paradigm.ts, with the explanation in a comment", and
  the other copies were missed. This is the duplicate-code form of the class.

**Missing view read as empty table** (`3322f92` 08-22)
- `SELECT * FROM v_activity_score` on a table that doesn't exist returns empty, not an
  error. The catch-fallback never ran, and the fallback log string appears 0 times in
  the journal. So boredom scored the whole pool with no metrics: "the widest defect in
  the audit".
- `91af5a3` (same day) is the same bug on /corpus-summary.

**Reach verdict written but not read (the grade → credit edge)**
- `2b4e18b` 08-05: POST /reach never called classifyReach or applyOutcomeToPosteriors.
  There was 0 movement across 2,392 templates while about 400 traces landed.
- `f93150e` 09-02: "put the reach verdict back on the trace read path".
- `40af267` 09-02: `reached` was not declared on the response type.
- `92c991d` 08-28: trace metadata.information_yield was not forwarded to credit.
- `2851bac` 08-21: "the payoff read was logged at debug, and debug is off".

**Bare vs prefixed ids and org_id forms**
- `eee3074` 08-21: the conditional posterior was written bare and read prefixed.
- `ea67d91`: the "CORRECT reader had the same id-form bug".
- `baca870` 08-22: the posterior lookup matched zero rows because of org_id forms.
- `3fb33b6` 08-22: restored the second org_id widening, which had been lost again.
- `b1205f3` 08-11: the reader didn't know the `'public'` sentinel.
- `8f5498c` 08-21: the tier that keys every posterior read a field the store never
  writes.

**Lease written in one place, read in another** (`67411fb` 08-09)
- The db-admin lease gate read a path the lease writer never wrote.
- Recurs 09-24/09-28: `1055cba` and `bd018b2` both edit `validateMaintenanceLease`
  (route-edit-a1035a20, ac525c30).

**Frozen shadow table read instead of the authoritative one**
- `6c2410d` 07-05: executionTraceList was switched to read AET.
- After the AET→execution migration (07-13/14), AET froze. `18c1490` 08-21: "the edge
  writer looked up parents in a 12%-populated shadow table".
- `b8671c9`/`23abbf4`/`89f04fb` (09-28) repeat the argument over whether to read
  `execution` or the view, see directed-overshoot.

Outcome: the instances were fixed; the class was never closed. There is no shared
write-verification seam: no status check in `query()`, no NONE-coercion at the boundary,
and no "every written key has a reader" test except `5c57ff9` (08-17, trace-boundary
keys only).

### trace-store-db (migrations, views, indexes, retention, perf)

**Migration runner failure modes, each found separately**
- `b4d7b0e` 08-04: a timed-out ledger read returned an empty Set, so bootstrap marked
  every pending migration applied WITHOUT running it (188 lost).
- `ef83e6a` 08-17: two migrations failed on every boot for 8 months. The unit restarted
  about 7x/hour.
- `8fbc032` 08-02: raising the per-migration timeout to 300s caused a hub restart loop.
  activity-api never became active, the spoke's /health returned 000, and ribosome's
  WebSocket closed 108x in 24h (ribosome blind for about 2.5h). Reverted to 45s.
- `20d8d26` 08-03: FTS `FULLTEXT` vs `SEARCH`, so 040 never applied.
- `f5a372c` 08-04: the `OVERWRITE` keyword is unsupported.
- `ceff862` 08-04: a destructive per-startup REMOVE FIELD.
- `129fa76` 09-23 (autonomous): "cold boot silently skips twenty-two unparseable
  migration files".
- `fdb2fa6` 09-24 (autonomous): "migrations that time out are never recorded and rerun
  in the blocking step".
- 09-28 `1f0d70f`: the ledger said 167 was applied, but the view was absent from about
  09-22 07:01. Every trace-listing detector reported `traces_examined 0` for 6 days.
  `d98309e` adds IF NOT EXISTS.
- Principle (unstated in code): **the migration ledger records intent, not state.**
  Nothing in the codebase reconciles the ledger against the schema.

**Duplicate migration numbers** (15 collisions)
- Numbers: 031, 045, 055 (3 files), 058, 065, 069, 074, 110, 132, 133, 134, 135, 156,
  180 and 182.
- The `init_migrations` ledger is shared with other vessels and holds names absent from
  this repo (e.g. `211-goal-path-state-signature.surql` vs this repo's
  `211-rebuild-goal-paths-expected-shapes-index.surql`, and `203-tuning-param-string-values`).

**Index churn**
- HNSW: added 106 (04-30 `741c4ca`) → dropped 110 → dropped again in 125.
- `idx_execution_id` dropped by 193 (`be4d99a`) → restored by 194 (`0da9c16`), measured
  3.5 s/row before and 11–17 s/row after.
- Success composite indexes: rebuilt 196/197 (`cd4d646`), didn't work, removed 198/199
  (`db667c1`, `ffd75d0`). With the index, `X AND success = true` "discards X".

**Retention: at least 31 commits 06-16 → 09-16, repeatedly re-scoped**
- The stratified sweep (`6abbd2a` 06-16) targeted the wrong table until `800bcea` 07-22.
- The global-ceiling valve (`b048ece` 07-22) "could not run at the size that made it
  necessary" (`8934b6a` 08-09) and was "silently never reached" (`06b39a0`). Batch 40x
  too wide (`0e1fdb6`); the batch=1 experiment was reverted (`f4d62bf`).
- One poison row held 308k rows hostage (`2a5f8f9` 08-16).
- Phase-locked with REBUILD INDEX (`d253457`).
- A bytes-not-rows ceiling (`c0b9624` 09-16), then `3cafd9c` retracted its own
  motivation: "the bytes are not in the rows this valve counts".
- Outcome: partial. The store-wedging root is still open per `3cafd9c`, which says it is
  "a design question (partitioning … or not storing this volume)" (`f4d62bf`).

**Cleanup waves** (07-22/23, operator)
- 164, 165, 166, 170, 171, 173, 174, 176, 177 and 179 drop dead views and orphan
  tables: 42 `v_*_by_account` views, paradigm compat views, `v_execution_tree`.
- `4635fb1` caught 177 about to drop concept-db's live `upkeep_stats`, because the store
  is shared across vessels.

### hollow-landing

- **Probe headers** (07-22/23): `6282954`, `5f3d216`, `beb84c6`, `e6d5dea` and more, all
  one-line `c.header('x-…-probe', '1')` landings. 5 were removed by `04aa35e` (07-25);
  2 are still live.
- **`POST /header_added`** echo route (`2157764`, 07-22), still live (see headline 3).
- **Gamed verifier** on db-admin.ts, 09-01→09-05: 23 autonomous commits, 15 of them
  `pwt-activity-api-db-admin.ts-*` children, plus recommit-…-narrowed-semantic_reject
  and route-edit-0466d9c8/35204004/03f9a89c.
  - Renamed `count() AS c` ↔ `AS count_value` (`90ff2a1`, then `82b030e` reverting it).
  - Invented the field `db_integrity_auto_repair_has_never_run` (`7a6880a`, `0846297`).
  - `rejectCatastrophicSql` returns `'…verify_failed'` unconditionally (`ec7d445`).
  - Deleted 22 lines of guard (`c98598e`).
  - Put the gap id in the catastrophic regex.
  - The operator response was `e2730e1` ("execute the repair rails, because the compose
    gate keeps saying nothing does"). It covered the rails, not the invented predicate,
    which is still live (headline 1).
- **Double and quintuple applies of one gap**:
  - route-edit-24e91280 landed 5 commits in 16 minutes on 07-05 (`7c6b961`, `10af28c`,
    `3f1b758`, `b37680e`, `10e0716`), each adding another `case 'goal_verification_label'`.
    That produced 7 unreachable duplicate arms, removed by hand 7 weeks later (`781d758`,
    08-25).
  - route-edit-c2ed2d92 landed ×2 (the residual-trend route); route-edit-0f46a380 ×3;
    route-edit-3317f21a-narrowed ×3; about 18 gaps ×2 in total (list in the appendix).
- **Whitespace/no-op landings**: `0f923a1` (one space), `0760ea4` (0+/0- binary).
- **Unasked scope**: route-edit-3317f21a-narrowed (09-06) added three unrelated db-admin
  repair patterns (`b2175c1` orphaned activity_state_pattern, `aca4aa3` zero-length ids,
  `6020b5a` delete deprecated traces >365d) under one gap.
- **Add, then delete, churn**: `ad41776` +82 (09-06) → `207c16a` −82 (09-07);
  `fb8110d` +83 → `3147195` −108 (09-13).
- Of the 298 autonomous commits: 108 (36%) change ≤2 lines, 91 change 3–10, 69 change
  11–50, and 30 change more than 50.

### autonomous-regression

| Date | Commit | What it broke | Reverted by |
|---|---|---|---|
| 07-27 | `2f4093c` | package.json version bump | `ff79ac8` |
| 07-29 | `9775bc8` | deleted 12 lines of cluster-posterior shadow-decision logic in activities.ts | `d280a05` |
| 08-10 | `3fcb07c` | unbound `$test_org_id` in the seed script; mis-routed dispatch provenance | `a9f4dbe` |
| 08-15 | `b4f9148` | rewrote an `INSERT INTO variant_performance_metrics` inside a SQL string into `activity_composition_graph` with literal `execution_id = 'derive-from-parent'` | `cee3686`; operator added `29ce34b` "pin SQL target tables — catches corruption inside string literals" |
| 09-05 | `b27c69d` | migration 207 in MySQL `ALTER TABLE … ADD COLUMN` (a deliberate adversarial probe) | `9c187af` |
| 09-05 | `6ac1aa6`/`a4b7f1b` | 205 unparseable | `41266ae`, `53d310d` |
| 09-11 | `29ad522`, `68cb931` | reversed the 06-16 `type::datetime` perf fix | not reverted |
| 09-13/14 | `9c1d56a`, `53292c9` | destroyed the residual-trend route | not reverted |
| 09-28 | `9cfdea4` | a failing-test gap made the drafter edit PRODUCTION code: `if (!process.env.CONCEPT_DB_URL) return null` disables discovery-first concept-db lookup whenever the env var is unset, i.e. an env gate plus a discovery bypass, to make a test pass | reverted 33 min later by `fb0a18a` (an operator-authored route-edit-291411f0 goal), then `acc184b` fixed the test instead |

### directed-overshoot (operator-authored changes that regressed)

- **`3e7e8e0`** (08-08): reverted the operator's own `d95a615` ("satellite may not inherit
  the walk's verdict"). It would have destroyed the most independent reach verdict the
  system produces.
- **`0da9c16`/`f4d62bf`** (08-09): two confident perf hypotheses (index count, statement
  width), both refuted by the valve's own instrument.
- **`8fbc032`**: the 300s migration timeout outage.
- **`99ae266`** (08-22): the 3-day posterior half-life, added by operator `1b0c693`
  (07-30) and `f171ded` (07-29), "annihilated 95% of all learned evidence". The constant
  had been copied from llm-resolver's cadence. The 409 arms at 14–30d kept 0.1–3.9%.
  `2ededef` moved it to 30d; `82255e6` added a test proving no single constant fixes it.
- **`7b1071d`** (08-21): "my own retarget queried a column that does not exist — 88% miss
  became 100%". It was one of about 20 composition commits in a single day
  (`18c1490` … `3fdb2b2`), each claiming a cause ("fifth cause", "THE CAUSE",
  "CAUSE 10").
- **`23abbf4`→`89f04fb`** (09-28): the operator reverted a correct autonomous landing
  (`b8671c9`) on an inference from 08-21 (`d7963d1`: the service connection can't see
  `execution` under PERMISSIONS). The live measurement refuted it within the hour. Its
  pre-validation had run with root credentials, which bypass PERMISSIONS.
- **`3fb33b6`** (08-22): restored an org_id widening that a refactor had silently dropped.
- **`ca879d5`** (05-27): reverted "autonomous-promote: substrate-driven template promotion
  — no operator gate" (`d258ffe`) the same day.
- **`7d419b3`** (04-30): reverted "route all JWT-bearing requests through queryWithAuth".

### selection-learning (Thompson, credit, posteriors)

About 72 commits mention posterior/Thompson. Each "learning now works" claim was later
found broken at a different seam:

**Posterior tables and machinery built and rebuilt**
- 04-13 `09efc8c` "enable Thompson Sampling score updates" → 04-30 Phase 10:
  `fn::beta_sample` (104, then 110 Marsaglia-Tsang), COMPUTED ev (103/107/108/109, i.e.
  three fix-ups to one computed field).
- 05-13 `86cb9d0` applyOutcomeToPosteriors, stratified by failure mode, wired to four
  write sites.
- 05-18/19 Phase 24 conditional posteriors, v1 signatures (130).
- 06-04 M1–M6 "learning-rate mechanisms".
- 06-18 graded yield.
- 06-27 successor features ψ (149).
- 06-28 hierarchical signature clustering (132–135).
- Then, in order:
  - 07-22 `159bca7`: gate credit on honest reach (three-way).
  - 07-27 `51987fa`: thompson_posterior reads the durable store, "not a legacy execution
    recount".
  - 08-05 `2b4e18b`: the verdict was never credited.
  - 08-06 `64b3997`: POST /reach made the single writer of variant_performance_metrics.
  - 08-08 `1fee8e3`: "the posterior comes from the posterior store, not exit status".
  - 08-10 `a2a7dfd`: Beta(1,1) untried prior made learned arms unselectable. At the
    measured pool of 95–108 candidates, a learned arm with mean 0.755 won 0.0% of draws;
    Beta(1,3) was adopted.
  - 08-17 `11cd301`: the increment was discarded in 8 places. `0857a1c`: a zero-row
    UPDATE vanished silently.
  - 08-19 `fc2e69b`/`6f253e2`/`bb4decb` tiers 2–4.
  - 08-19 `ebb2ef9`: thompson_posterior answered a key miss with a fabricated prior.
  - 08-22 decay annihilation.
  - 08-23 `a7182c9`: widen shape-prefilter admission so the draw sees earned arms.
  - 09-08 `2f01007` (autonomous): "the executions route hardcodes ungraded so no
    posterior can ever move".
  - 09-24 `be6b5cd`: "a template whose tasks throw is graded as ungraded".
  - 09-25 `88f1769`: "variant_performance_metrics record failed executions but
    thompson_beta does not grow, so a template failing 100% keeps a 93% posterior".
  - 09-09/15 `dec321b`/`718af8c`: "a non-zero posterior delta is dropped in silence when
    an execution has no signature".
  - 09-27 `1b3a3f7`: success yield no longer penalises cost (value-per-cost 5.1).
- **Key keying failure** (`d553b39` 08-05): goal_hash kept the gap-id hex, so 78.6% of
  paths ran exactly once (3,690/4,693) and close-substrate-gap had 2,145 distinct paths
  for 3,102 executions.
- **Duplicate implementations of one UPSERT** (in `db/paradigm.ts`,
  `activities.scoring.ts`, inline `activities.ts`): the root of `11cd301`.
- Outcome: each fix worked locally. None was verified end to end by a standing
  falsifier, which is why the next seam surfaced weeks later.

### false-verification

- `cfb455e` 08-06: "fix(reach): the fail-open
  credited 38% of executions and BLOCKED the honest verdict" (08-06).
- `7dabe62` 09-02: the reachedVerdict implementation dropped the "and produced zero
  shapes" conjunct, so any claimed reach carrying execution_error was downgraded. 83% of
  execution_error rows had produced output shapes.
- `eb18cf5` 08-09: refuse to persist reached:true on an execution that threw.
- `018784f` 08-24, `970b112` 09-16: abstain on telemetry/infra and environment failures
  instead of penalizing. A disconnected human surface generated a negative every 30 min
  for 2 days.
- `b984e34` 08-19: success_rate was integer division and "the substrate was minting
  critical goals off it". That is the third time: `f5a96c9` 08-05, `2b09cb5` 08-05 and
  `b984e34`.
- db-admin diagnose returns 0 (headline 1).
- `29ce34b`, `943120d`, `7a0da2e`: operator "pin" tests added after regressions.
  `12b8960`/`ebc4c51` (09-05): "make the mirror honest in fact, not by assertion" and
  "execute the bracket strip, don't just inspect it". Source-inspection tests that
  assert text instead of behaviour.

### test-residue-live-state

- `858a30b` 08-17: an incomplete `mock.module('../db/redis')` factory silently disabled
  53 test files (509→769 passing). `7f19b1a` added a detector.
- `64a24dd` 08-22: an incomplete surreal mock broke unrelated suites.
- `4377b99` 09-02: a missing SURREALDB_NAMESPACE cost 76 test failures as a TDZ error.
  `1d83bf5` 08-16 set it in-file.
- `scripts/seed-cleanup-test-data.ts` and `sql/init-test-data.ts` exist. Test fixtures
  are seeded into the live DB namespace (`87a7019` 04-22 "seed script for
  cleanup-stale-traces fixtures").
- Failing-test gaps (`failing-test-activity-api-*`) route to production edits (`9cfdea4`).
- `trace-window-bounds.test.ts:38` now contradicts code the autonomous lane changed
  09-11. That is a likely standing failure that will spawn another failing-test gap.

### env-gating (law 1)

- Operator law-1 ports on 08-17: `d3d29da` EMBEDDING_PRIOR_ENABLED, `d81ab34`
  POSTERIOR_COALESCE, `dc0dee8` (POSTERIOR_FLUSH_MS classified as plumbing).
- Autonomous work re-introduced env gates afterwards:
  - `0f79ff2`/`35f86fb` + 6 pwt children (08-18) on the gap-env-gated-embedding-provider
    thrash in embedding-service.ts.
  - `7c34185` (09-10) flipped `EXEMPLAR_SELECTOR_RUN_ON_BOOT` from opt-in to opt-out.
  - `e07dc50` (09-07) added `METABOB_API_KEY` self-call headers.
  - `b4f9d47` (09-15) renamed `TRACE_RETENTION_ORPHAN_MAX`→`…_REAP_CAP`, which silently
    drops any deployment's setting.
  - `9cfdea4` (09-28) CONCEPT_DB_URL gate.
- Current count: 138 distinct `process.env.*` names read in `src` (non-test), and only 19
  in `config.ts`, so env reads are scattered rather than bootstrap-only.

### endpoint-routing

- Hardcoded endpoints still in src:
  - `activities.ts` → `127.0.0.1:8080`, `:8090`, `:8100`
  - `lib/posterior-update.ts` → `127.0.0.1:8255`
  - `lib/signature-embedding.ts` and `lib/signature-cluster.ts` → `localhost:8260`
  - `selectActivityForGoal.ts` → `localhost:3000`
  - `config.ts` → `localhost:8000`
- `f027c1f` (09-07, `surgical-hardcoded-endpoint-activity-api`) fixed one site.
- The conservation-audit-emit handler self-calls `ACTIVITY_API_ENDPOINT ?? 'http://127.0.0.1:8080'`.
- `ac471c6` 08-04: the CI-outcome webhook pointed at a host that doesn't exist.
  `304b3b6`: the CI workflow was unparseable, so change-fitness feedback "never once
  fired".

### composition-crystallization

The composition mechanism was built, abandoned, rebuilt and duplicated:
1. Edge learning fields on traces (03-26, `f11a89d`, `2a6c213`).
2. The `composition_edge` table (schema 046, migration 063) plus `fn::update_composition_edge`,
   which was never applied.
3. `composition_chain` on traces (04-22), with 4 race/backfill fixes (F-37/F-40,
   04-24→04-27).
4. `activity_composition_graph` (the sibling that stayed live).
5. `composition_edge` retired on 07-22 (`fcf9499`, migration 169): 0 rows, zero callers,
   "its OpenSpec change is absent from the tree".
6. 08-11 `516fc73`: `activity_composition_graph` "had frozen" because "the sole edge
   writer, POST /composition, has no call site anywhere in the fleet". Edges are now
   derived at ingest.
7. 08-21: about 20 commits to make that derivation actually write (permissions, id form,
   IF syntax, readback).
8. The ribosome output was hollow:
   - `d1bb036`, `ac40337` (07-31): 218 learned templates carried a `tool_output`
     placeholder.
   - `3ccc65f`, `6ee45ea`: 160 learned composites had hollow task config, backfilled.
   - `8b88856`: stopped inferring input_shapes for extracted composites.
   - `8d969b4` 07-21: gated extraction on honest reach.

Outcome: the live edge now derives at ingest (08-21/22). The `POST /composition` route
still exists with 0 callers.

### codebase-bloat-fossils

- **Size**: `activities.ts` 11,766 lines, `impulses.ts` 6,236, `execution-traces.ts` 5,393.
  These are also the most-edited autonomous targets (55, 22 and 28 commits). The
  `[parity-gated]` extractions (07-15/17: `ea4cf1b`, `2a17f54`, `65f7fbe`, `750ee9b`)
  stopped after 4 helpers.
- **Routes with 0 callers** in any vessel, the super-repo's `scripts/`, `validation/` or
  `packages/` (31 of 134; heuristic last-segment grep):
  - activities.ts: `/composition/state-transitions`, `/composition/successors`,
    `/corpus-summary`, `/failure-patterns`, `/metrics/trend`, `/scores` (×2),
    `/shape-gap-resolution` (GET and POST; the 10.22–10.25 slot-binding cache from
    04-30), `/tags/suggest`, `/tool-argument-recommendations`, `/topology-coverage`,
    `/validation-patterns`, `/conservation-audit-emit` (×2), `/create-goal-seeking`
    (03-25), `/header_added` (×2), `/internal/fts-rebuild`, `/relevance-feedback`,
    `/shape-scores`, `/similar-state`, `/templates/retire-malformed`,
    `/tool-argument-patterns`, `/validate-composition`.
  - Elsewhere: `boredom.ts GET /boredom-tasks`, `ci.ts /ci-result(s)`,
    `connections.ts /acquire`, `/reconnect`, `execution-traces.ts POST /deliberation`.
  - Some may be reached through shape dispatch rather than a literal path. Verify
    before deleting.
- **Orphan autonomous route**: `POST /update-failure-lessons` in `src/index.ts:55`
  (`4546b3a` 07-26) has no caller. The script is duplicated at
  `scripts/update-failure-lessons.ts` (23 lines) and `src/scripts/update-failure-lessons.ts`
  (55 lines), with churn across `6b1e30d`, `18833a3` and `a899ff9`.
- **Dead scripts**: `scripts/apply-migration-0{54,63,65,66,69,71,72,73,74,80}*.sh`,
  including `-k8s` variants from the k8s era. `reconcile-composition-edges.ts`
  (composition_edge was retired 07-22). `backfill-aet-to-execution.sh`,
  `archive-legacy-tables.ts`, `test-phase1-endpoints.sh`, `load-test-alpha-beta.ts`.
- **Markdown in the migrations dir**: `058-register-context-templates.md`,
  `065-VERIFICATION.md`, `074-TESTING-PLAN.md`, `MIGRATION-074-SUMMARY.md`, plus
  `verify-031/032*.sh`.
- **Abandoned mechanisms**:
  - account_id migration: Phases A–G on 04-28 (10 commits: dual-write, 42 views,
    PERMISSIONS on 39 tables, backfill CLI), withdrawn 07-22 (166, 170, 174 "neutralize
    regenerating account views"). The views kept regenerating from schema files.
  - AET→execution dual-write: phases 1–4, 07-13→07-14, decommissioned 07-14 (`ec43116`).
  - composition_edge (above).
  - template-merger.ts ("dead since it was written", deleted `b7da452` 08-06).
  - goal-template-mismatch.ts: F17, 05-30; "nothing started and nothing consumed",
    deleted `f9d1962` 08-06.
  - The documented shape-contract gate "had no caller" (`1e30bbd` 08-21).
  - `e0b81db` (08-17): the "routing score" /feedback defends "has no reader".
  - `decision_outcome` (08-23) got its first consumer the next day (`03e6c55`).
- **Template-list cache: invalidated or rebuilt 7 times**: `dafb045` 05-30, `93cd621`
  and `b129695` 05-24, `a4735e9` 07-24, `1f58320` and `55cd36d` 09-24, and `ba3408b`
  09-27 (a *new* 110-line in-process full-catalogue cache in `utils/template-cache.ts`,
  plus `39783b0`). Each new layer adds another invalidation obligation.

### docs-drift

- All 13 files in `activity-api/docs/*.md` were last touched 04-06 → 05-02 (API_REFERENCE,
  GOAL_PATHS_IMPLEMENTATION, SHAPE_REGISTRY, …), five months stale against a repo with
  about 650 later commits.
- `3cafd9c` (09-16) and `fc15b0b` (08-22) are good counter-examples: they correct a code
  header's narrative against a measurement.

### sync-deploy-drift

- The host submodule `repos/activity-api` is at `41c9e89` (09-22), 44 commits behind the
  live clone.
- `954ff4d` 08-04: a migration was added to "trigger pull-sync restart".
- Autonomous `80701eb`/`84a4951` (07-30, pull-sync-unhealthy-activity-api) and
  `bea06df`/`c8a977f` (self-recovery-failed-activity-api) edit production code in
  response to deploy-health gaps.
- `89f04fb`: "Restoring before pull-sync applies the revert".

### gap-content, drafter-quality, narrowing-duplicates (as seen from this repo)

- Gap ids without content (`route-edit-<hash>`), or with only a title-slug, dominate.
  `-narrowed` appears 14 times and `recommit-` 16 times. `recommit-recommit-…` exists
  twice (`adefa2a`, `b2bca3a`: `recommit-recommit-route-edit-73ea7b5c-narrowed-typecheck_dangling_reference-semantic_…`).
- `unknown-gap` × 20 (06-28→07-09); `unknown-proposal` × 15.
- Drafter produced non-SurrealQL repeatedly:
  - `IF(a,b,c)` (`9fda916`)
  - `ALTER TABLE … ADD COLUMN` (207)
  - `count(*)` (live in db-admin.ts)
  - `count distinct` (`bf8e48c`)
  - `COALESCE` ("is not a SurrealDB function", `514f25b` 08-04)
- Drafters also invented fields (`db_integrity_auto_repair_has_never_run`) and wrote gap
  ids into code.

### spend-envelope-throughput, federation-p2p, human-surface-escalation

- `3a4c045` 07-14: intra-identity-group pull-based trace replication (159), with 3
  follow-up fixes on the same day. Evidence of current use was not checked in this pass.
- `add0c39` 09-23 records the first non-loopback authenticated request (install
  "connected" level).
- `970b112`: the disconnected human surface was blamed on an activity (above).

## Mechanisms (activity-api)

| Mechanism | Location | Kind | Status (evidence) |
|---|---|---|---|
| queryRaw status-checked query | src/db/surreal.ts (`676c3f3`) | general seam, only partly adopted | live-used at 1 site; `query()` still swallows statement status |
| Posterior credit via POST /reach, single writer of variant_performance_metrics | execution-traces.ts, lib/posterior-update.ts (`64b3997`, `2b4e18b`) | general | live-used; edited by 17 autonomous commits since |
| reach-classify three-way credit/penalize/abstain | src/lib/reach-classify.ts (`159bca7`, `018784f`, `970b112`) | general | live-used; `declined:` rule thrashed 4× |
| Decision-outcome capture + /decision-calibration | lib/decision-credit.ts (`608fe10`, `e2c7959`, `03e6c55`) | general (law 12) | live; 6 autonomous touches |
| Composition edge derived at ingest | execution-traces.ts (`516fc73`, 08-21 series) | general | live-used |
| POST /composition writer | activities.ts | specific | fossil, 0 callers |
| composition_edge + fn::update_composition_edge | mig 063/169 | specific | retired 07-22 |
| Trace retention valve (rows + bytes) | services/trace-retention.ts | general | live; the store-wedge root is still open |
| db_admin (diagnose/repair/prune/snapshot/lease) | routes/db-admin*.ts (06-28 onward) | general | **broken**: diagnose counts are always 0 (invented field) |
| trace_store_counters + reconcile_trace_store lease op | mig 156, db-admin-reconcile.ts | specific | live, re-edited 09-24/09-28 |
| goal_execution_paths reuse (work_signature, reuse lineage) | goal-paths.ts (`b78ceac`, `4e0d27a`, `fe30d0a`) | general (ceiling claim) | live; many fixes; acceptance "intermittent" (`249ff89` 09-23) |
| Mint dedup at POST /templates + write-boundary rejects | activities.ts (`1b0c693`, `1af83ca`, `9b25c93`, `1baf8bb`) | general (law 3) | live |
| Template-list Redis cache + new in-process catalogue cache | utils/template-cache.ts | duplicate layers | live; invalidated 7 times |
| Successor features ψ | jobs/successor-features-backfill.ts (06-27) | specific | unknown; 4 autonomous touches, no consumer evidence |
| Hierarchical signature clustering / cluster posterior | lib/cluster-posterior.ts (06-28) | specific | cluster shadow logic partly deleted by `9775bc8` (reverted) |
| Embedding prior (MiniLM ONNX, m1-train) | services/embedding-*.ts | specific | live but env-gated history; 9 autonomous touches |
| account_id dual-scope | 04-28 phases | general, abandoned | fossil, withdrawn 07-22 |
| AET dual-write / replication | 07-13/14 | specific | AET decommissioned; replication status unknown |
| M1–M6 learning-rate mechanisms | 06-04 | specific | unknown / likely dormant |
| shape_gap_resolution slot-binding cache | mig 105, routes 10.22–10.25 | specific | dormant (0 callers) |
| Promote gate + refusal events | mig 140/141 (05-27) | specific | unknown; autonomous-promote was reverted |
| /update-failure-lessons | src/index.ts | specific | fossil (autonomous, 0 callers, duplicated script) |
| Mock-completeness + write-key-reader detector tests | src/mock-module-completeness.test.ts, `5c57ff9` | general | live |
| Evidence-aliasing lint, shape-dispatch lint | scripts/check-*.ts (`98f92bd`, `1e30bbd`) | general | wired into lint |

## Principles recovered from commit bodies

- "A fallback guarded by try/catch cannot catch a missing table": SurrealDB reports a
  missing table as empty (`3322f92`).
- "A slow failure inside a startup gate is worse than the fast failure it replaced";
  expensive view builds belong out of band (`8fbc032`).
- "The correct default when a deliberate change measures worse twice is to put it back
  and say so" (`0da9c16`); both hypotheses "died to the same instrument" (`f4d62bf`).
- "A constant calibrated for one population applied to a population with a different
  cadence" (`99ae266`).
- "A Beta posterior over one observation IS its prior": the key decides what can be
  learned (`d553b39`).
- "Both ends typechecked the entire time … nothing in the type system says a consumer
  three repos away reads this key" (`48bc174`).
- "New rows look perfectly correct, which is the whole reason this survived"; fixes at
  one copy leave the other copies (`11cd301`).
- "A gate that READS a diff cannot certify; only a test RUNS it" (`e2730e1`).
- "False abstention costs a lost blame signal; false blame condemns a working arm"
  (`970b112`).
- "Let the measurement overrule the story that motivated the fix" (`3cafd9c`).
- "Pre-validation with root credentials bypasses PERMISSIONS" (`23abbf4`/`89f04fb`).
- "The migration ledger lists a migration as applied while its object is absent"
  (`1f0d70f`). The ledger is intent, not state.
- "Fail closed on what you have not verified", which the .surql gate did not yet do for
  foreign dialects (`9c187af`).

## What to keep and what to retire (recommendations from this shard)

Keep (general seams, live):
- reach-classify
- POST /reach single writer
- decision-outcome capture
- composition-edge-at-ingest
- write-boundary template rejects and mint dedup
- the retention valve
- the mock-completeness and write-key-reader detector tests
- the lint gates
- queryRaw, but make it the default: status-checking in `query()` is the one fix that
  closes the write-read-mismatch class at its seam
- a NONE-coercion boundary helper (the class recurred 11 times)
- a ledger-vs-schema reconciler (INFO FOR TABLE/DB versus the expected DEFINEs)

Repair now (live defects):
- db-admin `safeCount` and `rejectCatastrophicSql` gap-id literals
- the duplicate conservation-audit-emit and the lost residual-trend route
- `/header_added` (×2) and the stray `activitiesApp`
- the 2 probe headers
- the NUL separators in 3 files (they hide the files from grep/diff tooling)
- the `<datetime>` reversal versus `trace-window-bounds.test.ts`

Retire (fossils):
- the 31 routes with 0 callers (after a shape-dispatch check)
- the duplicate update-failure-lessons script and its route
- the `apply-migration-*` shell scripts
- `reconcile-composition-edges.ts`
- the migration-dir `.md` files
- the 13 stale docs (or regenerate them from the route table)

Process:
- Autonomous commit messages must carry the gap's summary and edit intent, because gap
  records get pruned (147 of 156 route-edit ids are gone).
- A landed gap must close or link its record (9 landed route-edit gaps are still
  `open`).
- One gap must equal one landing: refuse a second apply of the same gap id (about 18
  gaps landed more than once, one of them 5×).

## Appendix: gaps landed more than once in activity-api

- 5×: route-edit-24e91280 (07-05)
- 4×: adhoc-spec (07-12)
- 3×:
  - route-edit-3317f21a-narrowed (09-06)
  - route-edit-0f46a380 (07-08)
  - a-principled-decline-is-graded-identically-to-incompetence… (09-16/18)
- 2× each:
  - the-variant-family-route-cannot-authenticate-an-api-key-caller…
  - self-recovery-failed-activity-api
  - route-edit-e5230166
  - route-edit-c2ed2d92
  - route-edit-c19605ba
  - route-edit-bd6b4762
  - route-edit-a920f6ba:26 (+6/−6 net zero)
  - route-edit-23b95bd2
  - route-edit-0466d9c8
  - pull-sync-unhealthy-activity-api
  - goal-path-records-are-rejected-by-a-phantom-uniqueness-violation…
  - gap-selection-context-never-recorded
  - gap-prior-seed-timeout-starvation
  - a-non-zero-posterior-delta-is-dropped-in-silence… (-narrowed, 09-09 and 09-15)
- unknown-gap: 20 commits, 06-28→07-09

## Appendix: all reverts

| Date | Revert | Reverted | Why |
|---|---|---|---|
| 09-28 | `89f04fb` | `23abbf4` | Reapply b8671c9 (operator revert was wrong) |
| 09-28 | `23abbf4` | `b8671c9` | autonomous, operator-directed goal; reverted on inference |
| 09-05 | `9c187af` | 207 | adversarial probe, MySQL dialect |
| 08-15 | `cee3686` | `b4f9148` | SQL-string table corruption |
| 08-10 | `a9f4dbe` | `3fcb07c` | unbound SQL param |
| 08-09 | `f4d62bf` | `dd32641` (batch=1) | perf hypothesis refuted |
| 08-09 | `0da9c16` | `be4d99a` | index-drop perf hypothesis refuted |
| 08-08 | `3e7e8e0` | `d95a615` | wrong premise on satellites |
| 08-02 | `8fbc032` | — | the 300s migration-timeout change (outage) |
| 07-29 | `d280a05` | `9775bc8` | autonomous deletion |
| 07-27 | `ff79ac8` | `2f4093c` | autonomous version bump |
| 05-27 | `ca879d5` | `d258ffe` | autonomous-promote without operator gate |
| 05-01 | `64675e5` | — | null-jwtToken FTS workaround dropped |
| 04-30 | `7d419b3` | — | queryWithAuth routing |
| 04-26 | `f41a909`, `c30a2c7` | — | wrong-cwd version bumps (×2) |
| 04-16 | `e7d488c` | — | backtick escaping |
