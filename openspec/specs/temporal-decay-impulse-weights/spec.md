# temporal-decay-impulse-weights Specification

## Purpose

All loaded impulses are currently treated as equally relevant by both the `POST /v2/activities/recommend` recommendation pipeline and the `searchConcepts` function in concept-db. An impulse loaded 2 seconds ago (the file currently being edited) should exert much stronger signal than one loaded 20 minutes ago (context from a long-completed earlier task). This spec introduces temporal decay so that recently-loaded impulses contribute proportionally more weight in two places: the BM25 query-token selection that drives activity recommendation and the `calculateImpulseRelevancyBoosts` alpha/beta adjustment. MiniBob already records per-impulse load timestamps in `ImpulseLoadEvent.loaded_at_timestamp`; this spec surfaces those timestamps in the recommendation request.

Temporal decay is a modifier on the **forward arm** of the two-direction learning duality: it scales the `impulseRelevance` posterior (alpha/beta boosts) by recency so that recently-loaded impulses carry proportionally more signal. The reverse arm (slot-binding selection and Thompson Sampling over activity variants) is unaffected by this spec; decay weights are not propagated into the selection posterior.

---

## Requirements

### Requirement: session_context extended with load_timestamps_ms

The `session_context` object accepted by `POST /v2/activities/recommend` SHALL be extended with an optional `load_timestamps_ms` array whose elements are parallel to the `loaded_shapes` array in that same object. Each element is a Unix epoch millisecond timestamp recording when the corresponding shape was loaded into the session.

The field is optional. When absent, all shapes are treated as having weight 1.0 (existing behaviour, no regression).

#### Scenario: request with load_timestamps_ms accepted

- **WHEN** a client posts to `POST /v2/activities/recommend` with `session_context.loaded_shapes: ["file", "git_diff"]` and `session_context.load_timestamps_ms: [1714000000000, 1714000300000]`
- **THEN** the server accepts the request without a 400 error and uses the timestamps to compute decay weights

#### Scenario: request without load_timestamps_ms unchanged

- **WHEN** a client posts to `POST /v2/activities/recommend` with `session_context.loaded_shapes: ["file"]` and no `load_timestamps_ms` field
- **THEN** the server processes the request identically to the current behaviour (weight 1.0 for every shape)

#### Scenario: mismatched array lengths are tolerated

- **WHEN** `load_timestamps_ms` has fewer elements than `loaded_shapes`
- **THEN** shapes beyond the end of `load_timestamps_ms` are assigned weight 1.0 and the request is not rejected

---

### Requirement: decay weight computed via exponential decay

The server SHALL compute a decay weight for each loaded shape using the formula:

```
w(t) = exp(-λ * age_seconds)
```

where `age_seconds` is `(request_time_ms - loaded_at_ms) / 1000` and `λ = ln(2) / 600` (half-life 600 seconds, i.e. 10 minutes).

Concretely:

| age       | weight  |
|-----------|---------|
|  0 s      | 1.00    |
| 10 min    | 0.50    |
| 20 min    | 0.25    |
| 30 min    | 0.125   |

Weights SHALL be clamped to `[0.0, 1.0]`. Negative ages (clock skew or same-millisecond delivery) SHALL be clamped to weight 1.0.

#### Scenario: shape loaded 10 minutes ago has weight 0.5

- **WHEN** a shape's `load_timestamps_ms` entry is exactly 600 000 ms before the server's current clock
- **THEN** the computed decay weight for that shape is 0.5 (within floating-point tolerance of 0.001)

#### Scenario: shape loaded 0 seconds ago has weight 1.0

- **WHEN** a shape's `load_timestamps_ms` entry equals the server's current clock
- **THEN** the computed decay weight is 1.0

#### Scenario: shape with a future timestamp clamps to 1.0

- **WHEN** `load_timestamps_ms` contains a value 5 seconds in the future (clock skew)
- **THEN** the computed decay weight is 1.0, not a value greater than 1.0

---

### Requirement: recency window alternative supported as a simpler strategy

As a second, implementation-selectable strategy, the server SHALL also support a step-function recency window:

- The **3 most recently loaded** shapes (by timestamp) receive weight `1.0`
- The **next 5** (positions 4–8 by recency) receive weight `0.5`
- All remaining shapes receive weight `0.1`

Implementors MAY choose either the exponential decay formula or the step-function window; both satisfy the intent of this spec. The chosen strategy SHALL be consistent within a single request. The step-function strategy requires no additional configuration and may be preferred when monotonic ordering of timestamps is more reliable than absolute clock values.

#### Scenario: step-function assigns correct tiers

- **WHEN** 10 shapes are provided ordered by recency (most recent first) and the step-function strategy is active
- **THEN** shapes 1–3 have weight 1.0, shapes 4–8 have weight 0.5, shapes 9–10 have weight 0.1

---

### Requirement: BM25 query token selection gated by decay weight

In `getActivitiesWithTieredFallback` (and any helper that constructs the BM25 / FTS query string from loaded shapes), the server SHALL vary the token contribution of each shape according to its decay weight:

- **weight >= 0.3**: the full token set for that shape is appended to the query string. The full token set is the shape name plus any additional tokens derived from the shape's associated path or content identifier (e.g. for a `file` shape pointing to `src/auth/jwt.ts`, tokens are `file src auth jwt`).
- **weight < 0.3**: only the bare shape name is appended (e.g. `file`), discarding the path/content-derived tokens.

This ensures heavily aged context does not dilute the query with stale path tokens while still providing a weak shape-type signal.

#### Scenario: fresh file shape contributes path tokens

- **WHEN** a `file` shape with path `src/auth/jwt.ts` has decay weight 0.95
- **THEN** the constructed BM25 query includes tokens derived from the path (`src`, `auth`, `jwt`) in addition to `file`

#### Scenario: stale file shape contributes only shape name

- **WHEN** a `file` shape with path `src/auth/jwt.ts` has decay weight 0.15 (loaded ~40 minutes ago)
- **THEN** the constructed BM25 query includes only the token `file`, not `src`, `auth`, or `jwt`

#### Scenario: threshold is exclusive at 0.3

- **WHEN** a shape has weight exactly 0.3
- **THEN** the full token set is used (>= 0.3 is the full-weight threshold)

---

### Requirement: calculateImpulseRelevancyBoosts multiplies by decay weight

The `calculateImpulseRelevancyBoosts` function in `repos/metabob-activity-api/src/utils/impulse-relevancy.ts` SHALL accept an optional `decayWeights: Map<string, number>` argument (keyed by impulse ID or shape name, parallel to `loadedImpulses`). Before adding an impulse's computed `alphaBoost` or `betaPenalty` to an activity's running total, both values SHALL be multiplied by the corresponding decay weight (defaulting to 1.0 when the impulse ID is absent from the map).

Concretely: if impulse X computes a raw `alphaBoost = 6` and its decay weight is `0.5`, the effective alpha boost applied is `3`.

#### Scenario: high-weight impulse contributes full boost

- **WHEN** impulse X has decay weight 1.0 and raw alphaBoost 6
- **THEN** the activity's alpha is increased by 6

#### Scenario: half-weight impulse contributes half boost

- **WHEN** impulse X has decay weight 0.5 and raw alphaBoost 6
- **THEN** the activity's alpha is increased by 3

#### Scenario: near-zero-weight impulse contributes negligible boost

- **WHEN** impulse X has decay weight 0.05 and raw alphaBoost 10
- **THEN** the activity's alpha is increased by 0 (floor to nearest integer before applying)

#### Scenario: missing decay weight defaults to 1.0

- **WHEN** `decayWeights` is not provided or does not contain a key for impulse X
- **THEN** the existing behaviour is preserved (weight 1.0, boost applied in full)

---

### Requirement: MiniBob populates load_timestamps_ms when calling recommend

When MiniBob calls `recommendActivities` via `mcp.ts`, it SHALL build the `session_context.load_timestamps_ms` array in parallel with `session_context.loaded_shapes` by reading `ImpulseLoadEvent.loaded_at_timestamp` from the current execution's impulse tracking. The `loaded_at_timestamp` field already exists on `ImpulseLoadEvent` in `src/types.ts`.

MiniBob SHALL include only impulses whose `loaded_at_timestamp` is defined and non-zero. Impulses with no timestamp (e.g. created before this feature shipped) SHALL be omitted from `load_timestamps_ms` but their shape SHALL still appear in `loaded_shapes` without a corresponding timestamp entry, which the server treats as weight 1.0 (per the mismatched-length rule above).

#### Scenario: recommend call includes load timestamps

- **WHEN** MiniBob has loaded two impulses with recorded `loaded_at_timestamp` values and calls `recommendActivities`
- **THEN** the HTTP request body contains `session_context.load_timestamps_ms` with two entries matching those timestamps

#### Scenario: legacy impulse without timestamp does not block the call

- **WHEN** an impulse in the current execution has no `loaded_at_timestamp` (zero or undefined)
- **THEN** `recommendActivities` still fires and the missing timestamp is not included in `load_timestamps_ms`; the server treats the shape as weight 1.0

---

### Requirement: concept-db searchConcepts accepts and applies decay weights

The `searchConcepts` function in `repos/concept-db/src/resolvers/concept.ts` SHALL accept an optional `decay_weights: Record<string, number>` parameter keyed by shape name. When provided, BM25 query term selection for each shape SHALL follow the same >= 0.3 / < 0.3 gating rule defined for the activity recommendation pipeline.

The HTTP endpoint that backs `GET /concepts/search` SHALL accept an optional `decay_weights` query-string parameter encoded as a JSON object (e.g. `decay_weights={"file":0.9,"git_diff":0.2}`) and forward it to `searchConcepts`.

#### Scenario: concept search applies decay to query tokens

- **WHEN** `GET /concepts/search?query=authentication&decay_weights={"file":0.9,"git_diff":0.1}` is called
- **THEN** the `file` shape's associated path tokens are included in the search query and the `git_diff` shape contributes only its bare name token

#### Scenario: concept search without decay_weights unchanged

- **WHEN** `GET /concepts/search?query=authentication` is called with no `decay_weights`
- **THEN** the behaviour is identical to the current implementation (all terms included)

---

### Requirement: decay parameters configurable via environment variable

The half-life used in the exponential decay formula SHALL be configurable via the `IMPULSE_DECAY_HALF_LIFE_SECONDS` environment variable (integer, default `600`). The step-function window sizes SHALL be configurable via `IMPULSE_DECAY_FULL_WEIGHT_COUNT` (default `3`) and `IMPULSE_DECAY_HALF_WEIGHT_COUNT` (default `5`).

All three variables are optional. When absent the defaults above apply.

#### Scenario: custom half-life applied

- **WHEN** `IMPULSE_DECAY_HALF_LIFE_SECONDS=300` is set and a shape was loaded 5 minutes ago
- **THEN** the computed decay weight is 0.5 (half-life of 5 minutes)

#### Scenario: default half-life used when env absent

- **WHEN** `IMPULSE_DECAY_HALF_LIFE_SECONDS` is not set and a shape was loaded 10 minutes ago
- **THEN** the computed decay weight is 0.5 (default 600 s half-life)

---

### Requirement: out of scope

The following items are explicitly out of scope and SHALL NOT be implemented here:

- Persisting decay weights or load timestamps to SurrealDB alongside execution traces
- Modifying the `impulse_relevance_metrics` schema or Thompson Sampling update path to account for impulse age at the time of execution
- Applying decay to the `discoverMissingImpulses` ranking
- Changing the step-function tiers or exponential decay λ dynamically based on session length or goal history
- Adding decay to the concept-db upkeep scheduler or the `decay-stale-relevance` upkeep rule (that rule operates on a different, longer timescale)
- Exposing decay weights in the recommendation response body or in activity dashboard metrics
