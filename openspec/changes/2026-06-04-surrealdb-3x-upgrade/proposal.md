# SurrealDB 3.x Upgrade — SQL Compatibility Fixes

**Scope:** All `.surql` files applied by `scripts/init-database.ts` (root `sql/`, `sql/schemas/`, `sql/migrations/`). Concept-db `sql/` is applied by the concept-db vessel on startup.

**Current version:** `2.3.3` (Dockerfile.substrate line 53)  
**Target version:** `3.x` (minimum 3.0.0; test against latest 3.x stable)

---

## Breaking changes by category

### 1. `FULLTEXT ANALYZER` → `SEARCH ANALYZER`

`FULLTEXT` keyword was removed in SurrealDB 3.0. The replacement is `SEARCH ANALYZER`. The index still uses `BM25` and `HIGHLIGHTS` identically; only the keyword changes.

**Risk: HIGH** — these indexes are queried at runtime via `@0@`/`@2@` operators and `REBUILD INDEX`. On 3.x, the `DEFINE INDEX … FULLTEXT ANALYZER` statement is a parse error; the index is never created; all FTS queries return zero results silently.

**Note:** Migration 136 already used the correct `SEARCH ANALYZER` syntax for two new index names (`idx_activity_fts_name`, `idx_activity_fts_tags`). However the app code in `src/db/paradigm.ts` and `src/jobs/fts-rebuild.ts` references the **old** names (`idx_activity_name_fts`, `idx_activity_description_fts`, `idx_activity_tags_fts`). The fix must update the old-named indexes in 111 and 126 (or add a new migration that drops the old and recreates with `SEARCH ANALYZER`). The cleanest path is a new migration 144 that redefines all three under their existing names using `SEARCH ANALYZER`.

| File | Lines | Old | New |
|------|-------|-----|-----|
| `sql/migrations/111-fts-bm25-highlights.surql` | 30, 35 | `FULLTEXT ANALYZER activity_analyzer BM25(1.2, 0.75) HIGHLIGHTS` | `SEARCH ANALYZER activity_analyzer BM25(1.2, 0.75) HIGHLIGHTS` |
| `sql/migrations/126-activity-tags-fts.surql` | 21 | `FULLTEXT ANALYZER activity_analyzer BM25(1.2, 0.75)` | `SEARCH ANALYZER activity_analyzer BM25(1.2, 0.75)` |
| `sql/schemas/040-fts-recommendation.surql` | 104, 109, 119 | `FULLTEXT ANALYZER activity_analyzer BM25(1.2, 0.75)` | `SEARCH ANALYZER activity_analyzer BM25(1.2, 0.75)` |

**Preferred fix:** Rather than editing historical migrations (which init-database.ts will skip for live DBs via init_migrations tracking), add migration `144-fts-search-analyzer-3x.surql`:

```surql
-- Migration 144: Replace FULLTEXT ANALYZER with SEARCH ANALYZER for SurrealDB 3.x compatibility.
-- FULLTEXT keyword was removed in SurrealDB 3.0. OVERWRITE rebuilds the index.
DEFINE INDEX OVERWRITE idx_activity_name_fts
  ON activity FIELDS name
  SEARCH ANALYZER activity_analyzer BM25(1.2, 0.75) HIGHLIGHTS;

DEFINE INDEX OVERWRITE idx_activity_description_fts
  ON activity FIELDS description
  SEARCH ANALYZER activity_analyzer BM25(1.2, 0.75) HIGHLIGHTS;

DEFINE INDEX OVERWRITE idx_activity_tags_fts
  ON activity FIELDS tags
  SEARCH ANALYZER activity_analyzer BM25(1.2, 0.75) HIGHLIGHTS;

REBUILD INDEX idx_activity_name_fts ON activity;
REBUILD INDEX idx_activity_description_fts ON activity;
REBUILD INDEX idx_activity_tags_fts ON activity;
```

Also update the schema file for new installs (affects `IF NOT EXISTS` path):
- `sql/schemas/040-fts-recommendation.surql` lines 104, 109, 119: `FULLTEXT ANALYZER` → `SEARCH ANALYZER`

---

### 2. `DEFINE INDEX … COLUMNS` → `DEFINE INDEX … FIELDS`

`COLUMNS` was an alias for `FIELDS` in SurrealDB 2.x and was removed in 3.0. All occurrences are in `DEFINE INDEX` statements.

**Risk: MEDIUM** — on a live DB where init_migrations already tracks these files, they are skipped. For fresh installs (local substrate, CI) the index definitions fail to parse and the tables run without indexes (queries work but degrade to full scans). This will surface as slow queries under load, not hard errors.

**Affected files and all line numbers:**

| File | Lines | Change |
|------|-------|--------|
| `sql/migrations/056-shape-registry.surql` | 96, 99, 102, 105, 108, 226, 227, 228, 229, 232, 233, 234, 235 | `COLUMNS` → `FIELDS` (13 occurrences) |
| `sql/migrations/065-state-aware-selection.surql` | 65, 66, 67, 68, 120, 121, 122, 151, 152, 190, 191 | `COLUMNS` → `FIELDS` (11 occurrences) |
| `sql/schemas/027-vessel-registry.surql` | 67, 70, 73, 76 | `COLUMNS` → `FIELDS` (4 occurrences) |
| `sql/schemas/030-circuit-breaker-health.surql` | 189, 190, 191, 194, 195, 197, 200, 201, 202, 203, 204, 207, 208, 209, 210 | `COLUMNS` → `FIELDS` (15 occurrences) |
| `sql/schemas/046-composition-graph.surql` | 190, 191, 192, 193, 196, 197, 198, 199, 200, 203, 206, 207, 208, 209, 210 | `COLUMNS` → `FIELDS` (15 occurrences) |

**Fix:** Bulk `sed` replacement is safe here — `COLUMNS` appears only in `DEFINE INDEX` context in these files:

```bash
for f in \
  repos/metabob-activity-api/sql/migrations/056-shape-registry.surql \
  repos/metabob-activity-api/sql/migrations/065-state-aware-selection.surql \
  repos/metabob-activity-api/sql/schemas/027-vessel-registry.surql \
  repos/metabob-activity-api/sql/schemas/030-circuit-breaker-health.surql \
  repos/metabob-activity-api/sql/schemas/046-composition-graph.surql; do
  sed -i 's/\bCOLUMNS\b/FIELDS/g' "$f"
done
```

Because these files are already applied on live DBs (init_migrations), the `COLUMNS → FIELDS` change in-place only helps fresh installs. For live DBs, indexes need to be re-created via a new migration. Add `145-reindex-columns-to-fields.surql` that re-issues `DEFINE INDEX OVERWRITE` for each affected index using `FIELDS`.

---

### 3. `TYPE number` → `TYPE float` or `TYPE int`

The `number` type was removed in SurrealDB 3.0. Use `float` for fractional values, `int` for counters. These files are applied on startup; on 3.x the `DEFINE FIELD` statement fails silently for SCHEMALESS tables or hard-errors for SCHEMAFULL, causing writes to reject the affected fields.

**Risk: MEDIUM** — the tables involved (`execution_traces`, `impulse_resolution_metrics`, `activity_metrics`, `external_validation_history`, `goal_paths`, `activity_prerequisites`, `prerequisite_patterns`) are all write-path tables. Field-level errors on SCHEMAFULL tables will reject inserts.

| File | Lines | Field | Old type | New type |
|------|-------|-------|----------|----------|
| `sql/004-execution-traces.surql` | 20 | `duration_ms` | `number` | `float` |
| `sql/004-execution-traces.surql` | 21 | `cost_usd` | `number` | `float` |
| `sql/008-impulse-resolution-metrics.surql` | 27 | `latency_ms` | `number` | `float` |
| `sql/008-impulse-resolution-metrics.surql` | 28 | `cost_usd` | `number` | `float` |
| `sql/007-control-flow-data-flow-learning.surql` | 24, 30, 31, 35, 36, 37, 38, 39, 73, 105 | various `count`, `rate`, `alpha`, `beta`, `duration`, `cost` fields on `goal_paths`, `activity_prerequisites`, `prerequisite_patterns` | `number` | `float` for rates/costs/alphas, `int` for counts |
| `sql/migrations/053-external-validation.surql` | 39–42 | `*_successes`, `*_failures` on `activity_metrics` | `number` | `int` |
| `sql/migrations/053-external-validation.surql` | 93 | `duration_ms` on `external_validation_history` | `number` | `float` |

**Fix:** Edit each file in-place; for live DBs add migration `146-type-number-to-float-int.surql` with `DEFINE FIELD OVERWRITE` for each affected field.

Mapping rule: `_count`, `_successes`, `_failures` → `int`; everything else (`_ms`, `_usd`, `_rate`, `alpha`, `beta`, `reliability`) → `float`.

---

### 4. `JOIN` in SurrealDB functions (concept-db)

`JOIN` is not valid SurrealDB syntax; it is standard SQL and was never supported. The `fn::weak_edges()` function in `sql/upkeep/002-upkeep-views.surql` uses `JOIN concept AS c1 ON …`. This fails at parse time whenever the function is called.

**Risk: LOW** — `fn::weak_edges()` is called by the upkeep activity, not by the hot request path. The function has never worked on any SurrealDB version (the clause would also fail on 2.x).

**File:** `repos/concept-db/sql/upkeep/002-upkeep-views.surql` lines 50–57

**Old:**
```surql
RETURN SELECT e.*, c1.relevance AS from_relevance, c2.relevance AS to_relevance
  FROM concept_edge AS e
  JOIN concept AS c1 ON e.from_concept = c1.id
  JOIN concept AS c2 ON e.to_concept = c2.id
  WHERE c1.relevance > 0.7
    AND c2.relevance < 0.3
    AND e.weight < 0.3
    AND e.edge_type = 'related_to'
  LIMIT 50;
```

**New** (use record fetch via `->` or subquery):
```surql
RETURN SELECT
    id, edge_type, weight, from_concept, to_concept,
    from_concept.relevance AS from_relevance,
    to_concept.relevance AS to_relevance
  FROM concept_edge
  WHERE from_concept.relevance > 0.7
    AND to_concept.relevance < 0.3
    AND weight < 0.3
    AND edge_type = 'related_to'
  LIMIT 50;
```

---

### 5. `.map()` closure syntax in SurrealDB functions (concept-db)

`fn::island_concepts()` uses `.map(|$x| $x.from_concept)` — a closure syntax that was introduced in SurrealDB 2.1 and remains valid in 3.x. This is **not** a breaking change; no action required.

---

## Items that are NOT breaking in 3.x (confirmed safe)

| Pattern | Status |
|---------|--------|
| `DEFINE ACCESS … TYPE JWT` | Valid in 3.x |
| `DEFINE FUNCTION OVERWRITE fn::…` | Valid in 3.x |
| `PERMISSIONS FULL` / `PERMISSIONS NONE` on DEFINE FIELD | Valid in 3.x |
| `DEFINE TABLE … AS SELECT … GROUP BY` (materialized views) | Valid in 3.x |
| `rand::float()` | Valid in 3.x |
| `array::group()` in SELECT aggregate | Valid in 3.x |
| `array::flatten()`, `array::distinct()` | Valid in 3.x |
| `HNSW DIMENSION … DIST COSINE TYPE F32 EFC … M …` | Valid in 3.x (not used; dropped by migration 110/125) |
| `ASSERT $value != NONE` on DEFINE FIELD | Valid in 3.x |
| `REBUILD INDEX … ON …` | Valid in 3.x |
| `IF NOT EXISTS` on DEFINE TABLE / DEFINE INDEX | Valid in 3.x |
| `SELECT VALUE` | Valid in 3.x |
| `TYPE option<string>`, `TYPE record<…>` | Valid in 3.x |
| `DEFINE FIELD … FLEXIBLE` | Valid in 3.x |

---

## Dockerfile.substrate version bump

**File:** `Dockerfile.substrate` line 53

```diff
-ARG SURREAL_VERSION=2.3.3
+ARG SURREAL_VERSION=3.3.0
```

Replace `3.3.0` with the current latest stable 3.x release from https://github.com/surrealdb/surrealdb/releases. At time of writing, `3.3.0` is the latest stable 3.x release. Pin to an exact patch version, not `latest`.

---

## Migration plan (execution order)

1. Edit in-place: `sql/004`, `sql/007`, `sql/008` (TYPE number → float/int), schemas `027`, `030`, `040`, `046` (COLUMNS → FIELDS, FULLTEXT → SEARCH). These apply on fresh installs only.
2. Add migration `144-fts-search-analyzer-3x.surql` — redefines the three live FTS indexes with `SEARCH ANALYZER` + REBUILD.
3. Add migration `145-reindex-columns-to-fields.surql` — `DEFINE INDEX OVERWRITE … FIELDS` for all 58 affected indexes from items 2 above.
4. Add migration `146-type-number-to-float-int.surql` — `DEFINE FIELD OVERWRITE … TYPE float|int` for all affected fields.
5. Fix `sql/upkeep/002-upkeep-views.surql` in concept-db (item 4).
6. Bump `Dockerfile.substrate` ARG.
7. Rebuild substrate image; run `make -C scripts/substrate substrate-run` against the new image; verify `INFO FOR DB` shows all FTS indexes with status=ready and `search::score(0)` returns non-zero for a known term.

---

## Risk summary

| File | Issue | Risk |
|------|-------|------|
| `sql/migrations/111-fts-bm25-highlights.surql` | `FULLTEXT ANALYZER` | **HIGH** — FTS breaks entirely |
| `sql/migrations/126-activity-tags-fts.surql` | `FULLTEXT ANALYZER` | **HIGH** — FTS breaks entirely |
| `sql/schemas/040-fts-recommendation.surql` | `FULLTEXT ANALYZER` | **HIGH** — affects fresh installs |
| `sql/migrations/056-shape-registry.surql` | `COLUMNS` keyword | **MEDIUM** — fresh installs lose 13 indexes |
| `sql/migrations/065-state-aware-selection.surql` | `COLUMNS` keyword | **MEDIUM** — fresh installs lose 11 indexes |
| `sql/schemas/027-vessel-registry.surql` | `COLUMNS` keyword | **MEDIUM** — affects fresh installs |
| `sql/schemas/030-circuit-breaker-health.surql` | `COLUMNS` keyword | **MEDIUM** — affects fresh installs |
| `sql/schemas/046-composition-graph.surql` | `COLUMNS` keyword | **MEDIUM** — affects fresh installs |
| `sql/004-execution-traces.surql` | `TYPE number` | **MEDIUM** — write-path field rejection |
| `sql/007-control-flow-data-flow-learning.surql` | `TYPE number` (10 fields) | **MEDIUM** — write-path field rejection |
| `sql/008-impulse-resolution-metrics.surql` | `TYPE number` | **MEDIUM** — write-path field rejection |
| `sql/migrations/053-external-validation.surql` | `TYPE number` | **MEDIUM** — write-path field rejection |
| `repos/concept-db/sql/upkeep/002-upkeep-views.surql` | `JOIN` syntax | **LOW** — upkeep activity only, never worked |
