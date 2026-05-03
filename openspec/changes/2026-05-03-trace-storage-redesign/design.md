# Design: Trace Storage Redesign

**Change ID**: `2026-05-03-trace-storage-redesign`

## Status

**Phase A + Phase B deployed to production** (`metabob-activity-api` v1.17.0-a58fafc, 2026-05-02).

Verified on `metabob-production` cluster:
- `idx_aet_activity_success_time` — `IndexScan` confirmed via EXPLAIN (was TableScan pre-deploy). Metadata-only query now ~164ms (was ~1400ms).
- `idx_aet_org_activity_success_time` — `IndexScan` confirmed via EXPLAIN.
- `idx_execution_activity_success_time` — deployed, indexed.
- All four new tables present: `trace_digest`, `execution_trace_content`, `execution_system_traces`, `execution_exemplar`.
- `learning_track` + `last_classified_at` fields on both `activity` and `activity_template`.
- Stress aggregation `count() WHERE success = true GROUP ALL` over 31K rows returned in 1.06s (no crash — previous risk).
- Per-activity GROUP BY aggregation over 31K rows: 1.17s, healthy.
- Dual-write paths wired (trace_digest + execution_trace_content); new tables currently at 0 rows pending first real write-path execution.

Open: Phase C (read-fallback), Phase D (gated content-field drop), integration tests (3.5-3.7, 3a.7-3a.9, 4.5, 4.6, 6.5-6.6), task 1.3 (P95 latency watch), task 8.4 (storage measurement).

## 1. Context and current state

Two tables hold execution traces today and both stay in production:

- `activity_execution_traces` (legacy, schema in `repos/metabob-activity-api/sql/schemas/011-executions.surql`) — 31K rows on canary, average row ~16.6KB, contains `tasks`, `state_snapshot`, `execution_trace`, `impulse_resolutions`, `output_impulses`, `output_impulse_shapes` all FLEXIBLE.
- `execution` (paradigm-aligned, schema in `repos/metabob-activity-api/sql/schemas/020-paradigm-core-tables.surql`) — 17K rows, `trace` is the FLEXIBLE catch-all field, `success` index already present (`idx_execution_success`), composite `(org_id, success, executed_at)` already present (`idx_execution_org_success_time`).

Schema 011 documents the legacy table as deprecated with a forward path to `execution`, but the codebase still writes both. `repos/metabob-activity-api/src/routes/execution-traces.ts:1370` extracts task details from `body.execution_trace`, builds the AET row at lines 1373-1431, and INSERTs at line 1550. The paradigm path runs in parallel from `repos/metabob-activity-api/src/db/paradigm.ts:353` (INSERT INTO execution) which copies `trace` from the same payload at line 324. This change is written to handle both paths symmetrically; the long-term consolidation is owned elsewhere.

Measurements that motivate the redesign:

- `WHERE success = true ORDER BY executed_at DESC` on `activity_execution_traces` triggers a TableScan in EXPLAIN. The migration 102 indexes (`(org_id, executed_at)`, `(account_id, executed_at)`, `(parent_execution_id)`, `(activity_id, executed_at)`) do not cover `success` on this table.
- Per-row metadata-only access pulls the entire 16.6KB payload off RocksDB because `tasks`, `state_snapshot`, `execution_trace`, `impulse_resolutions`, and `output_impulses` ride in the same row.
- `_goal_resolve` and `_activity_execute` synthetic ids (referenced at `execution-traces.ts:135, 1065, 1999, 2242`) plus `validator-dispatch` and `slot-binding` lifecycle activities account for the bulk of row count without producing per-row Thompson signal.
- Default SurrealDB persistence is non-syncing per https://surrealdb.com/docs/surrealdb/reference-guide/configuration/data-storage and https://github.com/surrealdb/surrealdb/issues/5541. A pod-level crash silently discards buffered trace writes.
- Recall paths today fetch the full row even when the consumer (binding-layer recommendation, exemplar surface) only needs `(activity_id, success, output_impulse_shapes)` plus a per-task tuple list.

## 2. Coordination with `2026-04-29-surrealdb-rl-layer`

`surrealdb-rl-layer` is in active rollout; its tasks file marks P1 (atomic +=), P2 (COMPUTED `ev`), P3 (`fn::beta_sample`) as deployed primitives the rest of the system can rely on. This change does not redo any of those:

- COMPUTED `ev` is read directly by the adaptive exemplar selector (§7) — we consume `activity_template.ev` rather than re-deriving from α/β.
- `fn::beta_sample` is unused here; selection is deterministic given the success ratio.
- Atomic α/β updates are upstream of system-trace carve-out — the carve-out narrows what the existing atomic write paths see, but does not change their semantics.

What overlaps and must be coordinated:

- The Thompson update sites at `activities.ts:2262` and `activities.ts:2282` are the same lines `surrealdb-rl-layer` Phase 1 already converted to atomic `+=`. The system-trace skip in §6 wraps an `IF NOT system_activity_id` predicate around the existing atomic UPDATE; it does not revert the atomicity.
- The composition edge work in `surrealdb-rl-layer` Phase 5 (RELATE edges) is independent of this change. Both can ship in either order.

What is genuinely new in this change:

- `trace_digest`, `execution_trace_content`, `execution_system_traces`, `execution_exemplar` are all new tables.
- `(activity_id, success, executed_at)` and `(org_id, activity_id, success, executed_at)` composite indexes on `activity_execution_traces` are new.
- The `SURREAL_SYNC_DATA=true` env var on the StatefulSet is new.

## 3. Schema design

### 3.1 New composite indexes on `activity_execution_traces`

The sibling `execution` table already has `idx_execution_success` and `idx_execution_org_success_time (org_id, success, executed_at)`. The legacy table needs the equivalents plus an `activity_id`-leading composite to support per-template exemplar recall.

```sql
DEFINE INDEX OVERWRITE idx_aet_activity_success_time
  ON activity_execution_traces
  FIELDS activity_id, success, executed_at;

DEFINE INDEX OVERWRITE idx_aet_org_activity_success_time
  ON activity_execution_traces
  FIELDS org_id, activity_id, success, executed_at;
```

`DEFINE INDEX CONCURRENTLY` (https://surrealdb.com/docs/surrealql/statements/define/indexes) is the SurrealDB 2.0+ form for online builds. Migration 102 used `DEFINE INDEX OVERWRITE` without `CONCURRENTLY`; the legacy AET corpus is small enough (31K rows) that an inline build completes in seconds. We match 102's style for consistency. If a future migration on a larger corpus needs zero-pause builds, `CONCURRENTLY` is the documented switch.

The `execution` paradigm table needs only the `activity_id`-leading composite to match:

```sql
DEFINE INDEX OVERWRITE idx_execution_activity_success_time
  ON execution
  FIELDS activity_id, success, executed_at;
```

### 3.2 `trace_digest` table

```sql
DEFINE TABLE IF NOT EXISTS trace_digest SCHEMAFULL
  PERMISSIONS
    FOR select WHERE org_id = $auth.org_id
      AND (project_id IS NONE OR project_id IN $auth.project_ids)
    FOR create WHERE $auth.org_id != NONE
    FOR update WHERE org_id = $auth.org_id AND $auth.role = 'admin'
    FOR delete WHERE org_id = $auth.org_id AND $auth.role = 'admin';

DEFINE FIELD execution_id        ON trace_digest TYPE string ASSERT $value != NONE;
DEFINE FIELD activity_id         ON trace_digest TYPE string ASSERT $value != NONE;
DEFINE FIELD success             ON trace_digest TYPE bool   ASSERT $value != NONE;
DEFINE FIELD duration_ms         ON trace_digest TYPE int    VALUE $value OR 0;
DEFINE FIELD cost_usd            ON trace_digest TYPE float  VALUE $value OR 0.0;
DEFINE FIELD failure_mode_type   ON trace_digest TYPE option<string>
  COMMENT "verifier_negative | budget_exhausted | safety_breach | cascading | user_abort";
DEFINE FIELD output_impulse_shapes ON trace_digest TYPE option<array<string>>;
DEFINE FIELD task_summaries      ON trace_digest TYPE option<array<object>> FLEXIBLE
  COMMENT "Per-task micro-tuple: {id, status, duration_ms, resolver_tier}";
DEFINE FIELD task_summaries.*    ON trace_digest TYPE object FLEXIBLE;
DEFINE FIELD org_id              ON trace_digest TYPE string
  ASSERT $value != NONE VALUE $value OR <string>$auth.org_id;
DEFINE FIELD project_id          ON trace_digest TYPE option<record<projects>>
  VALUE $value OR $auth.project_id;
DEFINE FIELD executed_at         ON trace_digest TYPE datetime VALUE $value OR time::now();

DEFINE INDEX idx_trace_digest_execution_id ON trace_digest FIELDS execution_id UNIQUE;
DEFINE INDEX idx_trace_digest_activity_success_time
  ON trace_digest FIELDS activity_id, success, executed_at;
DEFINE INDEX idx_trace_digest_org_activity_time
  ON trace_digest FIELDS org_id, activity_id, executed_at;
```

Why `output_impulse_shapes` lives here and not in content: `discover-by-shapes` recommendation reads this field directly when ranking candidates, and the field is small (typically <10 strings). Keeping it on the slim row avoids forcing recall paths to join.

Why `impulse_resolutions` lives in content (§3.3) and not here: it is consulted only during full-trace inspection (template extraction, ribosome) and is the largest contributor to row size.

### 3.3 `execution_trace_content` table

```sql
DEFINE TABLE IF NOT EXISTS execution_trace_content SCHEMAFULL
  PERMISSIONS
    FOR select WHERE org_id = $auth.org_id
      AND (project_id IS NONE OR project_id IN $auth.project_ids)
    FOR create WHERE $auth.org_id != NONE
    FOR update WHERE org_id = $auth.org_id
      AND ($auth.role = 'admin' OR created_by = $auth.id)
    FOR delete WHERE org_id = $auth.org_id AND $auth.role = 'admin';

DEFINE FIELD execution_id       ON execution_trace_content TYPE string ASSERT $value != NONE;
DEFINE FIELD tasks              ON execution_trace_content TYPE option<array<object>> FLEXIBLE;
DEFINE FIELD tasks.*            ON execution_trace_content TYPE object FLEXIBLE;
DEFINE FIELD state_snapshot     ON execution_trace_content TYPE option<object> FLEXIBLE;
DEFINE FIELD execution_trace    ON execution_trace_content TYPE option<object> FLEXIBLE;
DEFINE FIELD impulse_resolutions ON execution_trace_content TYPE option<array<object>> FLEXIBLE;
DEFINE FIELD impulse_resolutions.* ON execution_trace_content TYPE object FLEXIBLE;
DEFINE FIELD output_impulses    ON execution_trace_content TYPE option<array<object>> FLEXIBLE;
DEFINE FIELD output_impulses.*  ON execution_trace_content TYPE object FLEXIBLE;
DEFINE FIELD org_id             ON execution_trace_content TYPE string
  ASSERT $value != NONE VALUE $value OR <string>$auth.org_id;
DEFINE FIELD project_id         ON execution_trace_content TYPE option<record<projects>>
  VALUE $value OR $auth.project_id;
DEFINE FIELD created_at         ON execution_trace_content TYPE datetime VALUE $value OR time::now();

DEFINE INDEX idx_etc_execution_id ON execution_trace_content FIELDS execution_id UNIQUE;
```

The `execution_id` is the join key into both `activity_execution_traces` and `execution`. PERMISSIONS mirror the parent rows so a user who can read the metadata can read the matching content.

### 3.4 `execution_system_traces` table

```sql
DEFINE TABLE IF NOT EXISTS execution_system_traces SCHEMAFULL
  PERMISSIONS
    FOR select WHERE org_id = $auth.org_id
    FOR create WHERE $auth.org_id != NONE
    FOR update WHERE org_id = $auth.org_id AND $auth.role = 'admin'
    FOR delete WHERE org_id = $auth.org_id AND $auth.role = 'admin';

DEFINE FIELD execution_id  ON execution_system_traces TYPE string ASSERT $value != NONE;
DEFINE FIELD activity_id   ON execution_system_traces TYPE string ASSERT $value != NONE;
DEFINE FIELD success       ON execution_system_traces TYPE bool   ASSERT $value != NONE;
DEFINE FIELD duration_ms   ON execution_system_traces TYPE int    VALUE $value OR 0;
DEFINE FIELD cost_usd      ON execution_system_traces TYPE float  VALUE $value OR 0.0;
DEFINE FIELD parent_execution_id ON execution_system_traces TYPE option<string>;
DEFINE FIELD org_id        ON execution_system_traces TYPE string
  ASSERT $value != NONE VALUE $value OR <string>$auth.org_id;
DEFINE FIELD executed_at   ON execution_system_traces TYPE datetime VALUE $value OR time::now();

DEFINE INDEX idx_est_execution_id ON execution_system_traces FIELDS execution_id UNIQUE;
DEFINE INDEX idx_est_activity_time ON execution_system_traces FIELDS activity_id, executed_at;
DEFINE INDEX idx_est_parent_execution_id ON execution_system_traces FIELDS parent_execution_id;
```

The set of "system-track" templates is **not** maintained by hand. A hardcoded id list would rot the moment a new template family appears (`auth_resolve_v2`, `validator-dispatch-2026q2`, a renamed lifecycle wrapper) and would force a code edit before the trace pipeline classified the new id correctly. Worse, real activities like `auth_resolve_v1` are produced by pure vessels chaining local resolvers — they are real executions whose traces we still want captured, just not used as Thompson learning material. Routing decisions must therefore be **observed properties of the template** rather than configuration.

Each row in `activity_template` (and the paradigm-aligned `activity` row from `sql/schemas/020-paradigm-core-tables.surql`) carries a `learning_track` field with three possible values:

- `unclassified` — default for new rows; the classifier has not yet seen enough samples to assign a track. Traces still write to the standard `activity_execution_traces` / `execution` path.
- `learning` — the classifier has observed per-execution task and shape signal; traces feed posteriors as before.
- `system` — the classifier has observed effectively no learning signal across the sample window; traces route to `execution_system_traces` and are excluded from Thompson updates structurally.

`storeExecutionTrace` and `paradigm.insertExecution` consult this field at write time via a small helper (`resolveLearningTrack(activity_id)`); the helper has an in-process cache (60s TTL) so the lookup amortises across hot templates. Any failure of the helper — missing template row, query error, RPC timeout, NONE field on a legacy row — falls through to the default `activity_execution_traces` path. The classifier never blocks a write.

Migration 119 adds `learning_track` (default `'unclassified'`) and `last_classified_at` (default `time::now()`) to both `activity_template` and `activity`. The migration uses `DEFINE FIELD OVERWRITE` to keep idempotent reruns safe (matching migration 102's style and the `DEFINE FIELD OVERWRITE` precedent set by migrations 093/094).

### 3.5 `execution_exemplar` table

```sql
DEFINE TABLE IF NOT EXISTS execution_exemplar SCHEMAFULL
  PERMISSIONS
    FOR select WHERE org_id = $auth.org_id
    FOR create WHERE $auth.org_id != NONE
    FOR update WHERE org_id = $auth.org_id AND $auth.role = 'admin'
    FOR delete WHERE org_id = $auth.org_id AND $auth.role = 'admin';

DEFINE FIELD activity_id   ON execution_exemplar TYPE string ASSERT $value != NONE;
DEFINE FIELD execution_id  ON execution_exemplar TYPE string ASSERT $value != NONE;
DEFINE FIELD success       ON execution_exemplar TYPE bool   ASSERT $value != NONE;
DEFINE FIELD digest_id     ON execution_exemplar TYPE string
  COMMENT "trace_digest record id; recall paths read from digest first.";
DEFINE FIELD selected_at   ON execution_exemplar TYPE datetime VALUE $value OR time::now();
DEFINE FIELD org_id        ON execution_exemplar TYPE string
  ASSERT $value != NONE VALUE $value OR <string>$auth.org_id;

DEFINE INDEX idx_exemplar_activity_success ON execution_exemplar FIELDS activity_id, success;
DEFINE INDEX idx_exemplar_execution_id     ON execution_exemplar FIELDS execution_id UNIQUE;
```

A single execution can be selected as an exemplar at most once per cycle. The selection job clears and re-populates this table per activity, so `execution_id UNIQUE` is enough; no time-series log is kept here (the digest itself is the time-series).

## 4. Migration phases

Each phase is a separate migration file and reversible.

### Phase A — additive schema (migrations 113-117)

- 113: composite indexes on AET and `execution`. Reversible by `REMOVE INDEX`.
- 114: `trace_digest` table + indexes. Reversible by `REMOVE TABLE trace_digest`.
- 115: `execution_trace_content` table. Reversible.
- 116: `execution_system_traces` table. Reversible.
- 117: `execution_exemplar` table. Reversible.
- 119: `learning_track` and `last_classified_at` fields on `activity_template` and `activity` (default `unclassified` and `time::now()`). Reversible by `REMOVE FIELD`. Numbered 119 so 118 stays reserved for the gated content-field drop without renumbering.

After Phase A: schema exists; nothing writes to or reads from the new tables yet, and every template defaults to `unclassified`.

### Phase B — dual-write (code only, no migration)

- `execution-traces.ts:storeExecutionTrace` writes to AET (existing, unchanged), to `trace_digest`, and to `execution_trace_content`. System-activity ids route to `execution_system_traces` instead of AET.
- `paradigm.ts:insertExecution` mirrors the same split for the `execution` table.
- Read paths still source content from AET fields. The new tables are populated but not consulted.

After Phase B: every new execution emits one digest row, one content row (or one system-trace row); old reads still work because AET still carries the content fields.

### Phase C — read-fallback (code only)

- Read paths consult `execution_trace_content` first; on miss (legacy rows), fall back to AET fields.
- Recall paths (binding-layer recommendation, exemplar surface) consult `trace_digest` first; on miss, fall back to a slim projection from AET.
- Exemplar selector job starts running.

After Phase C: new traffic is served by the slim path; legacy rows continue to serve via fallback. This is the long-tail steady state.

### Phase D — content-field drop (migration 118, gated)

- Migration 118 drops the content fields from AET (`tasks`, `state_snapshot`, `execution_trace`, `impulse_resolutions`, `output_impulses`) and the equivalent from `execution.trace`.
- Gated behind operator confirmation — no auto-rollout. Only run after Phase C has been live long enough that legacy fallback hits drop to zero in a 24h window (target threshold to be set during Phase C).
- Reversible by `DEFINE FIELD` re-adding the fields, but the data is then permanently absent for pre-Phase-D rows.

After Phase D: AET row size collapses; all content lives in `execution_trace_content`.

## 5. Storage cost projection

Current state: 31K AET rows × 16.6KB = ~510MB; 17K execution rows × ~10KB = ~165MB. Total ~675MB; the synthesis cited a project total of 438MB which likely excludes auxiliary tables — we use the AET+execution direct measurement here.

After Phase D:

- 80% of AET rows (synthesis figure: ~25K of 31K) carry `_goal_resolve`/`_activity_execute`/lifecycle ids. They move to `execution_system_traces` at ~400 bytes each = ~10MB.
- The remaining 20% (~6K rows) split: metadata stays on AET (~600 bytes per row = ~3.6MB), content moves to `execution_trace_content` (~16KB per row = ~96MB), digest is ~400 bytes per row = ~2.4MB.
- `execution_exemplar` at default `N=20` per active activity holds at most ~20 × number-of-active-activities. With ~500 active activities that is ~10K rows × ~200 bytes = ~2MB.
- Indexes on the new tables add roughly 15% overhead on the active-row corpus.

Projected total (active-row corpus): ~115MB. The 438MB synthesis number is plausibly the steady-state target after Phase D; the 510MB starting point above is the pre-redesign measurement. Either way the order-of-magnitude reduction holds.

## 6. Observed learning-track classification

The Thompson Sampling write path at `repos/metabob-activity-api/src/routes/activities.ts:2262` and `:2282` (the two atomic `+=` UPDATE sites) is the only place AET rows feed posteriors. After this change those queries see only non-system-track rows because system-track rows go to `execution_system_traces` at write time. No additional skip filter is needed at the UPDATE site — exclusion is a structural property of routing.

### 6.1 Write-path branch with fall-through

The trace-store entry point at `execution-traces.ts:storeExecutionTrace` (verified at line 1550 — the INSERT block has `activity_id` available in scope, so a pre-INSERT branch is feasible) routes via `resolveLearningTrack`:

```typescript
// Before the existing AET INSERT block at line 1550
let track: LearningTrack = 'unclassified';
try {
  track = await resolveLearningTrack(activity_id); // cached, 60s TTL
} catch (err) {
  log.warn({ activity_id, err }, 'learning-track lookup failed; falling through to default');
  // track remains 'unclassified' -> default path
}

if (track === 'system') {
  await insertSystemTrace({ execution_id, activity_id, success, duration_ms, cost_usd, parent_execution_id, org_id });
  return; // do not write to AET, digest, or content
}

// 'learning' or 'unclassified' or any other value: existing AET path continues
// (digest + content + AET dual-write per Phase B)
```

The fall-through guarantee is explicit: any throw, NONE return, or missing template row routes the trace to `activity_execution_traces`. Traces are never lost to a classifier outage. The same branch lives at `paradigm.ts:insertExecution` (line 353).

### 6.2 Classifier signals and thresholds

The classifier job (`src/jobs/learning-track-classifier.ts`) re-evaluates every template whose `last_classified_at` is older than `LEARNING_TRACK_CADENCE_MS` (default 6h). For each template it queries `trace_digest` for the most recent `LEARNING_TRACK_SAMPLE_WINDOW` executions (default 50; minimum-required 5) and computes:

| Signal | Source | Rationale |
| --- | --- | --- |
| `avg_task_count` | mean of `array::len(trace_digest.task_summaries)` over the window | A template with persistently zero tasks is doing bookkeeping, not work whose structure we can vary or learn from. |
| `avg_output_shape_count` | mean of `array::len(trace_digest.output_impulse_shapes)` | An execution that produces no shapes contributes no signal to downstream binding. |
| `declared_output_shapes_count` | `array::len(activity.output_shapes)` from the template row itself | A template that *declares* output shapes is structurally a learning candidate even if a specific recent batch of executions was empty. |
| `output_shape_diversity` | count of distinct shape strings across the window | Low diversity over many executions is a system-bookkeeping signal (e.g., a wrapper that always emits one shape). Held in reserve as a tertiary tiebreaker; not part of the default decision. |

Default thresholds (knobs, declared in `LEARNING_TRACK_THRESHOLDS`, tunable via env):

- `learning` track when `avg_task_count >= 1.0` AND (`avg_output_shape_count >= 1.0` OR `declared_output_shapes_count >= 1`).
- `system` track when `avg_task_count < 0.5` AND `avg_output_shape_count < 0.5` AND `declared_output_shapes_count == 0`.
- `unclassified` otherwise (sample insufficient, or signals straddle the gap between thresholds).

The gap between 0.5 and 1.0 on the task and shape thresholds is intentional: a template that occasionally emits a task (mean ~0.7) is ambiguous and held at `unclassified` until it tips one way. Operators tune via env vars rather than re-deploying.

Why these signals: the user pointed out that `auth_resolve_v1` is produced by pure vessels chaining *local resolvers* — work that does not show up as `tasks`, but is real activity. The `declared_output_shapes_count` term protects such templates: if `auth_resolve_v1` declares an `authentication` output shape on its `activity` row, even zero-task executions are admitted to the learning track. The system-track demotion fires only when the template has *neither* tasks *nor* declared output shapes *nor* observed shape emission — i.e., it is structurally bookkeeping.

### 6.3 Re-evaluation cadence and drift

A template's `learning_track` is not sticky. Each cycle re-evaluates against the current sample window, so:

- A template that was `system` because early executions emitted nothing can move to `learning` after a refactor adds task structure.
- A template that drifted from useful to vestigial (every recent execution is a no-op) demotes to `system`.
- The 6h cadence means transitions take effect within hours of the underlying change, without an operator pushing a code edit.

The cycle is bounded: `O(template_count × sample_window)` digest reads. With ~500 active templates and a 50-row window, the cycle is ~25K digest reads, comfortably within the existing `setInterval`-driven job pattern in `src/jobs/embed-activities.ts` and `src/jobs/cleanup-vessels.ts`.

### 6.4 Backfill of existing rows

The 25K zero-task rows currently in `activity_execution_traces` are not moved by classification. Backfill is an explicit, separate concern (the proposal already lists exemplar backfill as out of scope). What the classifier does for those rows is **retroactively label their templates**: on its first cycle after migration 119 lands, it reads `trace_digest` (populated by Phase B dual-write) for every template, observes that templates like `auth_resolve_v1`, `validator-dispatch`, etc. have zero-task averages, and sets their `learning_track` to `system`. Subsequent traces for those templates route to `execution_system_traces`. Pre-existing rows stay in AET; they are inert (the Thompson updates triggered them once, and the next batch of `+=` happens on the new track only). If an operator later wants to evict pre-existing system-track rows from AET, that is a one-shot DELETE driven by `learning_track`, not part of this change's required path.

### 6.5 Fall-through guarantee summary

The carve-out is advisory in the strongest sense: at no point does the classifier sit in the critical path of a write succeeding. Every failure mode of the classifier (missing field on legacy template, query timeout, helper throw, in-process cache miss against a freshly-inserted template not yet replicated) routes the trace to the full path. The cost of being wrong about classification is at most a few rows landing in `activity_execution_traces` instead of `execution_system_traces`; the next classifier cycle corrects routing for future writes.

## 7. Adaptive exemplar selector

A new module `repos/metabob-activity-api/src/services/exemplar-selector.ts` runs the selection cycle. Two trigger modes:

- Nightly cron at low-traffic hours.
- Burst trigger after `N=20` new executions land for a single activity (threshold tunable).

Per activity:

```
1. Read activity_template.ev (COMPUTED field, deployed under surrealdb-rl-layer P2).
2. n_success = round(N x (1 - ev))
   n_failure = round(N x ev)
   Default N = 20.
3. Query trace_digest for activity_id with success = true, ORDER BY executed_at DESC LIMIT n_success.
4. Query trace_digest for activity_id with success = false, ORDER BY executed_at DESC LIMIT n_failure.
5. DELETE existing execution_exemplar rows for activity_id; INSERT the selected (execution_id, success, digest_id) rows.
```

Why this balancing: when α/β converges to high `ev` (template is reliable), the failure cases become the surprising/informative samples and we want more of them captured. When `ev` is low (template often fails), the success cases are the rare informative ones. The formula `n_failure = N x ev` may look inverted at first read; the rationale is the standard active-learning intuition that the rarer outcome class carries more bits.

Recall API surface (additive on `repos/metabob-activity-api/src/routes/execution-traces.ts`):

- `GET /v2/activities/exemplars?activity_id=<id>` → returns `[{execution_id, success, digest}]` reading from `execution_exemplar` joined with `trace_digest`.
- Recall path falls back to `trace_digest` ORDER BY when `execution_exemplar` is empty for the activity.
- 25ms median target read time, vs ~200ms today loading full AET rows.

## 8. Crash safety

`SURREAL_SYNC_DATA=true` ships in the SurrealDB chart's StatefulSet env block. The chart is at `repos/deployment/charts/surrealdb/templates/statefulset.yaml`; the existing env list contains `SURREAL_USER` and `SURREAL_PASS` from the secret. Add:

```yaml
- name: SURREAL_SYNC_DATA
  value: "true"
```

Reference: https://surrealdb.com/docs/surrealdb/installation/running/cli/environment-variables documents `SURREAL_SYNC_DATA` as the canonical setting. The default `false` and crash-safety implications are tracked in https://github.com/surrealdb/surrealdb/issues/5541.

Latency tradeoff: every commit waits for an fsync. SurrealDB's RocksDB backend amortises this across the WAL group commit, so steady-state throughput drop is bounded; the dominant impact is on burst write spikes. Document in the chart values comment.

## 9. Risks and mitigations

- **Read-fallback layer adds branching cost.** Mitigation: the fallback is a single `IF row.tasks IS NULL THEN read execution_trace_content` predicate; `execution_id UNIQUE` index covers the lookup. Phase C is bounded — Phase D drops the legacy path.
- **Classifier mis-classifies a real learning template.** A template with bursty execution patterns might land in a sample window that happens to be all-zero-task. Mitigation: the `declared_output_shapes_count` term and the 0.5/1.0 threshold gap leave structurally-meaningful templates at `unclassified` rather than demoting them. Operators audit via `GET /v2/admin/learning-tracks` and tune env-var thresholds without a deploy. Re-evaluation each cycle means a single bad classification self-corrects within 6h once new traces arrive.
- **Classifier outage.** If the classifier job stops running (process crash, scheduling regression), templates' `learning_track` values stale. Mitigation: this is the design's null state — staleness means traces continue routing exactly as they did at the last successful cycle, with the fall-through path absorbing any genuinely missing field. No write is blocked.
- **Cache staleness on `resolveLearningTrack`.** A 60s in-process cache means a transition from `system` to `learning` (or vice versa) takes up to 60s to take effect on a hot template. Mitigation: this is acceptable for a classifier that runs on a 6h cadence; cache invalidation on transition is not worth the complexity.
- **Exemplar selector starvation.** A new activity with no executions produces no exemplars. Recall path falls back to digest-only scan, which is the same behaviour as today modulo speed.
- **`SURREAL_SYNC_DATA` latency regression.** Mitigation: deploy to canary, observe write-path P95 over a 24h window. If regression exceeds 2x, fall back to `false` while we revisit.
- **Phase D irreversibility.** Once content fields drop, pre-Phase-D rows lose their content payload. Mitigation: Phase D is gated behind operator confirmation and a fallback-hit counter; no auto-promotion.
- **Two-path inconsistency between AET and `execution`.** Both tables are written today; the redesign keeps both in scope. If a row exists in AET but not in `execution` (or vice versa) the digest/content split must be applied symmetrically. Mitigation: writes are issued from a single helper that fans out to both legacy paths plus the new tables.

## 10. External docs cited

- SurrealDB environment variables: https://surrealdb.com/docs/surrealdb/installation/running/cli/environment-variables
- SurrealDB data storage / persistence configuration: https://surrealdb.com/docs/surrealdb/reference-guide/configuration/data-storage
- `DEFINE INDEX` (CONCURRENTLY syntax, SurrealDB 2.0+): https://surrealdb.com/docs/surrealql/statements/define/indexes
- SurrealDB issue 5541 — durability defaults: https://github.com/surrealdb/surrealdb/issues/5541
- COMPUTED `ev` field: deployed by `openspec/changes/2026-04-29-surrealdb-rl-layer/` design.md §3, migration `103-thompson-ev-computed.surql`.
- `fn::beta_sample`: deployed by the same change, migrations `104-fn-beta-sample.surql` and `110-fn-beta-sample-marsaglia-tsang.surql`.
