# impulse-state-query-augmentation Specification

## Purpose

When a caller has a set of impulses loaded in their session, those impulses carry
domain signal that the bare `task_description` string cannot express. A caller with
`["jwt_claims", "authenticated_user", "file:src/auth/jwt.ts"]` loaded is almost
certainly working in the authentication domain, even if their goal text is just
"fix login bug". This spec defines query augmentation: the loaded impulse state
is tokenised and appended to the BM25 query before any FTS search runs, so
auth-domain activities surface without requiring the caller to spell that out.

The technique is pseudo-relevance feedback / query expansion applied to the
impulse state space. No embedding model is required. The shape-exact `ALLINSIDE`
filter is unchanged — augmentation only enriches the text passed to the BM25
index.

---

## Scope

- A new optional `session_context` field on the `POST /v2/activities/recommend`
  request body.
- A token extraction function that converts shape names and pointer paths into
  FTS-safe terms.
- A recency window rule: impulses loaded within the most recent three positions
  contribute all extracted tokens; older impulses contribute shape-name tokens
  only.
- The same `session_context` forwarded to concept-db's `GET /concepts/search`
  endpoint when concept search is triggered from activity recommendations.
- No change to the `ALLINSIDE` shape-exact filter path.
- No new database tables or schema migrations.

---

## Definitions

**Session context** — a snapshot of the impulses currently loaded in the caller's
working memory, expressed as parallel arrays: shape names, pointer paths (file
paths, URIs, or empty string), and load timestamps in milliseconds since epoch.

**Token** — a single lowercase word extracted by splitting on `_`, `/`, `-`, `.`,
and whitespace, then discarding tokens shorter than two characters and a small
stop-list (`src`, `ts`, `js`, `the`, `and`, `for`, `in`, `of`).

**Recency window** — the three most recently loaded impulses, determined by
descending `load_timestamps_ms`. These are the "hot" impulses.

**Augmented query** — the original `task_description` string with unique, ordered
context tokens appended, separated by a single space.

---

## Requirements

### Requirement: `session_context` field on recommend request

`POST /v2/activities/recommend` SHALL accept an optional `session_context` object
in the request body with three parallel arrays:

```
session_context: {
  loaded_shapes: string[],          // shape names, e.g. ["jwt_claims", "authenticated_user"]
  loaded_pointer_paths: string[],   // file paths or URIs, empty string if none
  load_timestamps_ms: number[]      // epoch ms, parallel to the above two arrays
}
```

All three arrays SHALL be the same length. If lengths differ, the server SHALL
respond 400 with `"session_context arrays must be the same length"`. If
`session_context` is absent the endpoint SHALL behave exactly as before.

#### Scenario: Valid session_context is accepted

- **WHEN** a request body contains a `session_context` where all three arrays have
  length 2
- **THEN** the server processes the request and returns recommendations without error

#### Scenario: Mismatched array lengths are rejected

- **WHEN** `loaded_shapes` has length 3 but `load_timestamps_ms` has length 2
- **THEN** the server returns HTTP 400 with
  `{ "error": "session_context arrays must be the same length" }`

#### Scenario: Missing session_context is a no-op

- **WHEN** the request body contains `task_description` but no `session_context`
- **THEN** behavior is identical to the current implementation; no augmentation occurs

---

### Requirement: Token extraction from shape names

For each shape in `loaded_shapes`, the server SHALL extract tokens by splitting on
`_`, `-`, `.`, `/`, and whitespace. Tokens shorter than two characters and tokens
in the stop-list (`src`, `ts`, `js`, `the`, `and`, `for`, `in`, `of`) SHALL be
discarded. All tokens SHALL be lowercased.

Examples:
- `"jwt_claims"` → `["jwt", "claims"]`
- `"authenticated_user"` → `["authenticated", "user"]`
- `"activityExecutionTrace"` → `["activityexecutiontrace"]` (no split on camelCase;
  callers are expected to use snake_case or hyphenated shape names; camelCase is
  passed through as a single token and BM25 handles it)
- `"source_code"` → `["source", "code"]`
- `"error"` → `["error"]`

#### Scenario: Shape name tokenisation

- **WHEN** `loaded_shapes` contains `["jwt_claims", "authenticated_user"]`
- **THEN** extracted tokens include `["jwt", "claims", "authenticated", "user"]`

#### Scenario: Short and stop tokens are dropped

- **WHEN** `loaded_shapes` contains `["ts_error"]`
- **THEN** `"ts"` is dropped (stop-list) and extracted tokens contain only
  `["error"]`

---

### Requirement: Token extraction from pointer paths

For each element in `loaded_pointer_paths` that is non-empty, the server SHALL
split on `/`, `-`, `_`, and `.` and apply the same stop-list and length filter.

File extensions (`ts`, `js`, `tsx`, `jsx`, `py`, `go`, `rs`, `java`, `json`,
`yaml`, `yml`, `md`) SHALL be added to the stop-list for path tokenisation only,
so that `src/auth/jwt.ts` yields `["auth", "jwt"]` rather than `["auth", "jwt",
"ts"]`.

#### Scenario: File path tokenisation

- **WHEN** `loaded_pointer_paths` contains `["src/auth/jwt.ts"]`
- **THEN** extracted tokens are `["auth", "jwt"]` (not `"src"` — stop-list, not
  `"ts"` — extension stop-list)

#### Scenario: Empty pointer path is skipped

- **WHEN** `loaded_pointer_paths` contains `[""]`
- **THEN** no tokens are extracted from that entry

#### Scenario: URI path tokenisation

- **WHEN** `loaded_pointer_paths` contains `["concept-db/src/resolvers/concept.ts"]`
- **THEN** extracted tokens include `["concept", "db", "resolvers"]` (stop-list
  drops `"src"` and `"ts"`)

---

### Requirement: Recency window governs token contribution depth

The three entries with the largest `load_timestamps_ms` values are the hot
impulses. Hot impulses contribute both shape-name tokens AND pointer-path tokens.
All other impulses (cold) contribute shape-name tokens only; their pointer paths
are ignored.

If `session_context` contains three or fewer entries all are treated as hot.

#### Scenario: Hot impulse contributes shape and path tokens

- **WHEN** an impulse is in the three most recently loaded entries and has
  `loaded_pointer_paths[i] = "src/auth/jwt.ts"`
- **THEN** `["auth", "jwt"]` are included in the augmented query

#### Scenario: Cold impulse contributes shape tokens only

- **WHEN** an impulse was loaded before the three most recent entries and has
  `loaded_shapes[i] = "source_code"` and `loaded_pointer_paths[i] = "src/lib/util.ts"`
- **THEN** `["source", "code"]` are included but `["lib", "util"]` are NOT included

#### Scenario: All entries are hot when session_context has three or fewer

- **WHEN** `session_context` has exactly three entries
- **THEN** all three contribute both shape and path tokens regardless of timestamps

---

### Requirement: Augmented query construction

All extracted tokens SHALL be deduplicated (set semantics). Hot tokens from the
most recently loaded impulse are placed first, followed by tokens from the second
most recent, third most recent, then cold shape tokens — all within the appended
section. The `task_description` always precedes all context tokens unchanged.

The final augmented query SHALL be: `<task_description> <space-separated unique
context tokens>`.

The augmented query SHALL NOT be returned to the caller. It is internal to the
recommendation pipeline and SHALL be logged at debug level with a key of
`fts_query_augmented`.

#### Scenario: Augmented query combines description with tokens

- **WHEN** `task_description = "fix login bug"` and extracted context tokens are
  `["jwt", "claims", "authenticated", "user", "auth"]`
- **THEN** the string passed to `queryActivitiesByFTS` is
  `"fix login bug jwt claims authenticated user auth"`

#### Scenario: Duplicate tokens are deduplicated

- **WHEN** two loaded impulses both yield the token `"auth"`
- **THEN** `"auth"` appears exactly once in the augmented query

#### Scenario: Empty context tokens leave query unchanged

- **WHEN** all impulses in `session_context` yield zero tokens after filtering
- **THEN** the string passed to `queryActivitiesByFTS` equals `task_description`
  with no trailing space

---

### Requirement: ALLINSIDE shape filter is not altered

The `impulse_shapes` array and the `ALLINSIDE` shape-exact filter path in
`getActivitiesWithTieredFallback` are not affected by `session_context`. Query
augmentation applies only to the FTS query string. Tier 1 (shape-exact) and Tier
2 (compatible shapes, no FTS) behave as before.

#### Scenario: Shape filter unchanged alongside session_context

- **WHEN** a request includes both `impulse_shapes: ["error"]` and a
  `session_context`
- **THEN** Tier 1 still executes `input_shapes ALLINSIDE ["error"]` and Tier 3
  uses the augmented query; neither filter is derived from the other

---

### Requirement: Concept search augmentation

The `GET /concepts/search` endpoint in concept-db SHALL accept an optional
`session_context` query parameter encoded as a JSON string, with the same shape as
the activity-api field.

When present, the concept-db server SHALL apply the same token extraction and
recency window logic and append the resulting tokens to the `query` string before
executing the `CONTAINS` search.

Callers that invoke concept search as a step within an activity recommendation
chain SHALL forward `session_context` if it was present on the originating
recommend request.

#### Scenario: Concept search is augmented when context is forwarded

- **WHEN** a concept search is triggered with `query = "login"` and
  `session_context` containing `loaded_shapes = ["jwt_claims"]`
- **THEN** the underlying SurrealDB query matches on
  `"login jwt claims"` rather than `"login"` alone

#### Scenario: Concept search with no session_context is unchanged

- **WHEN** `GET /concepts/search?query=login` is called without `session_context`
- **THEN** the query issued to SurrealDB is `"login"` with no augmentation

---

### Requirement: Token extraction is deterministic and cheap

The token extraction function SHALL be a pure function with no I/O, no external
calls, and no memoisation requirements. It SHALL complete in under 1 ms for a
`session_context` with up to 20 entries. This keeps the augmentation step
invisible in endpoint latency.

#### Scenario: Large session_context does not increase response time observably

- **WHEN** `session_context` contains 20 entries, each with a 50-character path
- **THEN** the additional processing time before the FTS query fires is under 1 ms

---

### Requirement: Logging and observability

The server SHALL log a single debug-level entry per recommend request that includes
`session_context` with:
- `raw_shapes` — the `loaded_shapes` array
- `hot_count` — number of hot impulses
- `augment_tokens` — the deduplicated token array that was appended
- `fts_query_augmented` — the final augmented query string passed to `queryActivitiesByFTS`

No PII or full file contents are logged. Pointer paths are logged as-is because
they are paths, not content.

#### Scenario: Augmentation is visible in debug logs

- **WHEN** debug logging is enabled and a request includes a `session_context`
- **THEN** a log entry contains `augment_tokens` and `fts_query_augmented`
