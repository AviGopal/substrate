# tags-fts-index Specification

## Purpose

The `activity` table has FTS indexes on `name` (BM25 score 0, weight 2) and `description` (score 1, weight 1) but none on `tags`. Tags carry hierarchical intent (`bugfix.auth.tokens`, `feature.vessel.state`) that BM25-on-name misses (template names rarely include tag terms verbatim) and that dense embeddings handle inconsistently (semantic distance between "auth bug" and "bugfix.auth" is non-zero). Adding a third FTS index on `tags`, weighted between name and description, gives users a third independent retrieval signal at minimal infrastructure cost.

## Requirements

### Requirement: Tags FTS index defined with the existing analyzer

The system SHALL define `idx_activity_tags_fts` on `activity.tags` using the existing `activity_analyzer` (camel + class + blank tokenizers, lowercase + ascii + snowball English filters), BM25(1.2, 0.75), with HIGHLIGHTS enabled.

#### Scenario: Index exists after migration applied

- **WHEN** migration 126 runs against a fresh SurrealDB
- **THEN** `INFO FOR INDEX idx_activity_tags_fts ON activity` returns metadata including `analyzer: 'activity_analyzer'`, `BM25` scoring, and `HIGHLIGHTS: true`

#### Scenario: Index is rebuilt against existing rows

- **WHEN** migration 126 applies to a database with pre-existing `activity` rows
- **THEN** `REBUILD INDEX idx_activity_tags_fts ON activity` populates term-position metadata for all existing rows
- **AND** `search::score(N) WHERE tags @N@ '<term>'` returns non-zero for matching rows

### Requirement: queryActivitiesByFTS includes tags in WHERE and score

`queryActivitiesByFTS` in `repos/metabob-activity-api/src/db/paradigm.ts` SHALL include `tags @2@ '<sanitised-literal>'` in the OR'd WHERE clause and `search::score(2) * 1.5` in the ORDER BY ranking expression. Final ranking expression: `search::score(0) * 2 + search::score(2) * 1.5 + search::score(1) AS fts_score`.

#### Scenario: Tag-only match surfaces a template

- **WHEN** a template has `name = "Build Auth Service"`, `description = ""`, `tags = ["bugfix.auth.tokens"]`
- **AND** the FTS query is `q=auth`
- **THEN** the template appears in the result set with `fts_score >= search::score(2) * 1.5`
- **AND** the result is ranked above templates that match only on description

### Requirement: Hierarchical tag tokens score additively

When a query string contains multiple terms that match a hierarchical tag, BM25 SHALL accumulate the per-term scores across the matched tokens.

#### Scenario: Multi-token hierarchical query

- **WHEN** a template has `tags: ["bugfix.auth.tokens"]` (tokenized to `bugfix`, `auth`, `tokens`)
- **AND** the FTS query is `q=bugfix auth`
- **THEN** `search::score(2)` for that template is greater than for a template tagged only `["bugfix"]`
- **AND** the multi-tag-match template ranks above the single-tag-match template

### Requirement: Idempotent migration

Migration `126-activity-tags-fts.surql` SHALL be safe to re-run. `DEFINE INDEX OVERWRITE` rewrites the schema; `REBUILD INDEX` is idempotent against existing rows.

#### Scenario: Migration re-runs cleanly

- **WHEN** migration 126 is applied to a database where the index already exists
- **THEN** the migration runner records success without errors
- **AND** the index continues to return correct scores after the rerun
