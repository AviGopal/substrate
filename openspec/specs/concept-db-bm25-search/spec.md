# concept-db-bm25-search Specification

## Purpose

concept-db currently searches the `concept` table using `content CONTAINS $query OR summary CONTAINS $query`, which only returns rows where the query string appears as an exact substring. This fails for multi-word queries, stemmed variants, and natural-language phrases ("authentication error handling" will not match a concept whose content says "Handling auth errors"). SurrealDB 3.x provides a native BM25 full-text search path — `DEFINE ANALYZER` + `FULLTEXT` index + `@N@@` operator + `search::score()` — that handles tokenization, stemming, and relevance ranking with no external dependencies. The same pattern is already proven in metabob-activity-api (`sql/schemas/040-fts-recommendation.surql`). This spec replaces the substring match in `searchConcepts` with a BM25 query, keeps all existing scalar filters (`shape`, `source_type`, `min_relevance`) as `WHERE` predicates on top of the FTS match, and adds a SurrealDB migration file to land the analyzer and indexes.

---

## Requirements

### Requirement: concept_analyzer defined

concept-db SHALL define a SurrealDB analyzer named `concept_analyzer` using the tokenizers `blank`, `class`, and `camel` with the filters `lowercase`, `ascii`, and `snowball(english)`. This produces the same tokenisation pipeline as `activity_analyzer` in metabob-activity-api, which already handles natural-language prose, snake_case identifiers, and camelCase identifiers in a single pass.

#### Scenario: analyzer created idempotently

- **WHEN** the migration SQL is applied on a database that has no prior `concept_analyzer`
- **THEN** the statement succeeds and `INFO FOR DB` reports `concept_analyzer` in the analyzers map

#### Scenario: analyzer applied twice

- **WHEN** the migration SQL is applied a second time on the same database (e.g. re-run of schema bootstrap)
- **THEN** the `IF NOT EXISTS` guard prevents an error and the analyzer definition is unchanged

---

### Requirement: BM25 FULLTEXT indexes on content and summary

concept-db SHALL define two separate FULLTEXT indexes on the `concept` table:

- `idx_concept_content_fts` on field `content`, using `concept_analyzer` and BM25(1.2, 0.75)
- `idx_concept_summary_fts` on field `summary`, using `concept_analyzer` and BM25(1.2, 0.75)

Both SHALL be defined with `IF NOT EXISTS` for idempotent application. SurrealDB does not support multi-field FULLTEXT indexes; one index per field is required to obtain independent BM25 score handles.

#### Scenario: indexes present after migration

- **WHEN** migration `004-bm25-search.surql` is applied
- **THEN** `INFO FOR TABLE concept` reports both `idx_concept_content_fts` and `idx_concept_summary_fts` as FULLTEXT indexes

#### Scenario: new concept indexed automatically

- **WHEN** a `concept` row is created with non-empty `content` and `summary`
- **THEN** both FTS indexes update to include the new document without any manual refresh

#### Scenario: concept with null content

- **WHEN** a `concept` row has `content = NONE` (permitted by the schema's `option<string>` type)
- **THEN** `idx_concept_content_fts` skips that row gracefully and search queries against `content` do not error

---

### Requirement: searchConcepts uses BM25 when a query string is present

The `searchConcepts` function in `src/resolvers/concept.ts` SHALL replace the `content CONTAINS $query OR summary CONTAINS $query` predicate with a BM25 full-text match when `request.query` is non-empty.

The new query SHALL:

1. Use score index 0 for `content` (`content @0@@ $query`) and score index 1 for `summary` (`summary @1@@ $query`).
2. Weight `summary` matches at 2× relative to `content` matches, expressed as `search::score(0) + search::score(1) * 2.0` and aliased as `fts_score`.
3. Order results by `fts_score DESC` when a query is present, falling back to `relevance DESC, created_at DESC` when no query is given (filter-only requests).
4. Retain all existing scalar predicates — `org_id = $org_id`, `shape = $shape`, `source_type = $source_type`, `relevance >= $min_relevance` — as `WHERE` clauses composed alongside the FTS match.
5. Keep `LIMIT $limit START $offset` pagination unchanged.

When `request.query` is absent the function SHALL follow the original code path (scalar filters only, ordered by `relevance DESC, created_at DESC`) so that filter-only callers are unaffected.

#### Scenario: exact substring still matches

- **WHEN** a concept with `content = "JWT token validation middleware"` exists and `searchConcepts` is called with `query = "JWT validation"`
- **THEN** the concept is returned in the result set with a positive `fts_score`

#### Scenario: stemmed query matches

- **WHEN** a concept with `content = "running authentication checks on every request"` exists and `searchConcepts` is called with `query = "authenticate"`
- **THEN** the concept is returned because snowball(english) stems both "authentication" and "authenticate" to the same root

#### Scenario: multi-term query ranks by relevance

- **WHEN** two concepts exist — one whose `summary` contains all terms of the query and one whose `content` contains only one term — and `searchConcepts` is called with a multi-word query
- **THEN** the concept matching more query terms in `summary` appears before the concept matching fewer terms

#### Scenario: summary-weighted scoring

- **WHEN** two concepts exist — concept A with the query terms in `summary` only, concept B with the same terms in `content` only — and `searchConcepts` is called with that query
- **THEN** concept A ranks above concept B because `search::score(1) * 2.0` outweighs `search::score(0)` for equivalent term frequency

#### Scenario: shape filter still applied with FTS

- **WHEN** `searchConcepts` is called with `query = "error handling"` and `shape = "goal"`
- **THEN** only concepts with `shape = "goal"` are returned, even if other shapes match the FTS query

#### Scenario: min_relevance filter still applied with FTS

- **WHEN** `searchConcepts` is called with `query = "error handling"` and `min_relevance = 0.7`
- **THEN** only concepts whose stored `relevance` field is >= 0.7 are returned

#### Scenario: no query falls back to scalar-only path

- **WHEN** `searchConcepts` is called with no `query`, only `shape = "goal"` and `min_relevance = 0.5`
- **THEN** the SQL executed contains no `@@` operator and results are ordered by `relevance DESC, created_at DESC`

---

### Requirement: migration file added at `sql/core/004-bm25-search.surql`

A SurrealDB migration file SHALL be added as `repos/concept-db/sql/core/004-bm25-search.surql`. The file SHALL contain, in order:

1. `DEFINE ANALYZER IF NOT EXISTS concept_analyzer TOKENIZERS blank, class, camel FILTERS lowercase, ascii, snowball(english);`
2. `DEFINE INDEX IF NOT EXISTS idx_concept_content_fts ON concept FIELDS content FULLTEXT ANALYZER concept_analyzer BM25(1.2, 0.75);`
3. `DEFINE INDEX IF NOT EXISTS idx_concept_summary_fts ON concept FIELDS summary FULLTEXT ANALYZER concept_analyzer BM25(1.2, 0.75);`

No changes to `001-concept-tables.surql`, `002-add-impulse-signature-source-type.surql`, or `003-impulse-table.surql` are needed; the migration appends indexes without redefining the table.

#### Scenario: migration applied to a fresh database

- **WHEN** all four `sql/core/` files are applied in order to an empty SurrealDB namespace
- **THEN** the `concept` table exists with both FTS indexes and all original B-tree indexes intact

#### Scenario: migration applied to an existing database

- **WHEN** `004-bm25-search.surql` is applied to a database that already has the `concept` table populated with rows
- **THEN** SurrealDB back-fills the FTS indexes over existing rows and the migration completes without error

---

### Requirement: search endpoint response unchanged

The HTTP response shape from `GET /concepts/search` SHALL remain `{ concepts: Concept[], count: number }`. No new fields are added to the response body; `fts_score` is an internal query alias used for ordering and SHALL NOT be included in the returned concept objects.

#### Scenario: callers receive same response structure

- **WHEN** `GET /concepts/search?query=authentication` is called after the change
- **THEN** the response JSON has the keys `concepts` (array) and `count` (number), with each element matching the existing `Concept` type

---

### Requirement: out of scope

The following items are explicitly out of scope for this change and SHALL NOT be implemented here:

- Exposing `fts_score` as a field in the `Concept` response type or API response body
- Adding prefix/wildcard (`*`) query support
- Changing the impulse resolution contract for `conceptGraph` or `relatedConcepts` shapes
- Modifying the `concept_edge` or `concept_usage` tables
- Adding search to MCP tool responses beyond what `searchConcepts` already backs
