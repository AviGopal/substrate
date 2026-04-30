# Design: SurrealDB 3.x RL Layer — Moving the Learning Loop Closer to the Data

**Change ID**: `2026-04-29-surrealdb-rl-layer`

---

## 1. Architecture Framing

The system is a graph reinforcement learning agent. Its state is the set of impulse shapes available to the executor. Its actions are activity template applications (inputShapes → outputShapes). Its policy is Thompson Sampling over the composition graph. Its reward signal is execution success/failure driving α/β posterior updates.

This framing has a precise implication: **the database is the RL model**. The activity templates are the node set. The composition edges are the policy topology. The α/β posteriors on nodes and edges are the value function. Every execution trace is a policy evaluation sample. Every posterior update is a policy improvement step.

SurrealDB 3.0 exposes primitives that directly match these RL constructs:

| RL construct | DB primitive |
|---|---|
| Posterior update (no lost writes) | Atomic `+=` operator (SSI isolation) |
| Expected value derivation | `COMPUTED` field (read-time, always fresh) |
| True Beta sample for Thompson | Embedded JS `DEFINE FUNCTION` |
| Composition policy topology | `RELATE` edges with edge-payload filtering |
| Approximate nearest-neighbour search | HNSW index + `<|k,ef|>` KNN operator |
| Hybrid ranking | `search::rrf()` over BM25 + dense result sets |

The five changes in this proposal close the gap between the conceptual model and the implementation. They are not optimisations; they are alignment.

---

## 2. P1: Atomic α/β Updates

### Tables carrying α/β

Eight tables carry Thompson posterior fields:

| Table | Fields |
|---|---|
| `activity_template` | `thompson_alpha`, `thompson_beta` |
| `goal_execution_paths` | `thompson_alpha`, `thompson_beta` |
| `context_thompson_scores` | `alpha`, `beta` |
| `impulse_shape_activity_score` | `alpha`, `beta` |
| `variant_performance_metrics` | `thompson_alpha`, `thompson_beta` |
| `composition_edge` (RELATE table, P4) | `alpha`, `beta` |
| `discovered_state_pattern` | `alpha`, `beta` |
| `activity_state_affinity` | `alpha`, `beta` |

### Account attribution

Posterior updates are attributed to the executor's issuing account. Queries that read α/β for Thompson Sampling MUST scope by `WHERE account_id = $token.account_id` so each account's learning reflects only its own observed outcomes. Cross-account learning opt-in is governed by `share_learning = true` on a federation link (FC-3) — that is a separate mechanism, entirely orthogonal to execution scope grants (see §10 Federation and RL scoping).

### Non-atomic update sites

Four of the six active update sites use a fetch-modify-write pattern that loses updates under concurrent writes:

**Site 1 — `execution-traces.ts:1938`** (`storeExecutionTrace`, `activity_template`):
```typescript
// current (non-atomic)
const template = await db.select(`activity_template:${id}`);
const newAlpha = template.thompson_alpha + delta;
await db.merge(`activity_template:${id}`, { thompson_alpha: newAlpha, thompson_beta: newBeta });

// after
await db.query(
  `UPDATE activity_template:$id SET thompson_alpha += $da, thompson_beta += $db`,
  { id, da: deltaAlpha, db: deltaBeta }
);
```
Concurrency risk: HIGH. Multiple minibob replicas submit execution traces for the same template simultaneously after parallel goal runs.

**Site 2 — `activities.ts:3599`** (feedback positive, `impulse_shape_activity_score`):
```typescript
// after
await db.query(
  `UPDATE impulse_shape_activity_score:$id SET alpha += $da, beta += $db`,
  { id, da: deltaAlpha, db: deltaBeta }
);
```
Concurrency risk: MEDIUM.

**Site 3 — `activities.ts:3639`** (feedback negative, `impulse_shape_activity_score`):
Same pattern as Site 2. Concurrency risk: MEDIUM.

**Site 4 — `goal-paths.ts:402`** (`recordPathExecution`, `goal_execution_paths`):
```typescript
// after
await db.query(
  `UPDATE goal_execution_paths:$id SET thompson_alpha += $da, thompson_beta += $db`,
  { id, da: deltaAlpha, db: deltaBeta }
);
```
Concurrency risk: MEDIUM.

### Already-atomic sites (no change needed)

`execution-traces.ts:2094` and `execution-traces.ts:2154` — `context_thompson_scores` — already use `alpha + $alpha_delta` syntax in inline SurrealQL. These are the reference implementation pattern.

### Migration SQL

No schema migration required. Atomic `+=` is a SurrealDB 3.0 operator on existing numeric fields.

### Observability

Log `atomic_update: true` alongside the existing update log lines. Compare actual posterior values pre/post a burst of concurrent updates on canary to confirm no lost increments.

---

## 3. P2: COMPUTED `ev` Field

### EV computation today (four sites)

1. `activities.ts:4416` — `betaSample(alphaBlended, betaBlended)` — the main Thompson sampling call. This is true Beta sampling, not EV. COMPUTED `ev` complements (not replaces) it — `ev` is used for `ORDER BY` pre-filtering; Beta sampling is used for final candidate ranking.
2. `activities.ts:2181` — `thompson_score = alpha / (alpha + beta)` — returned in feedback response.
3. `execution-traces.ts:2444` — SQL already computes `alpha / (alpha + beta) AS expected_success_rate`. COMPUTED field makes this redundant (field already present).
4. `execution-traces.ts:2639,2769` — SQL aggregations computing mean EV for summary views. These remain as explicit computations since they aggregate across rows.

### DDL

```sql
-- Apply to all 8 tables with α/β.
-- Shown for activity_template; same pattern for remaining 7 tables.
DEFINE FIELD ev ON TABLE activity_template
  COMPUTED alpha / (alpha + beta)
  TYPE float;

-- variant_performance_metrics uses different field names:
DEFINE FIELD ev ON TABLE variant_performance_metrics
  COMPUTED thompson_alpha / (thompson_alpha + thompson_beta)
  TYPE float;
```

The `COMPUTED` keyword evaluates the expression at read-time from the stored α/β values. There is no write path for `ev`; it is always derived from live values and can never be stale.

### Recommend endpoint simplification

Current ranking (abridged from `activities.ts:4315-4367`):

```typescript
// ~80 lines: fetch candidates, loop, compute ev per template, apply 9 JS boost heuristics,
// sort in-process, slice to limit.
candidates.sort((a, b) => {
  const evA = a.alpha / (a.alpha + a.beta);
  const evB = b.alpha / (b.alpha + b.beta);
  return evB - evA; // plus boost/penalty adjustments
});
```

After COMPUTED `ev` field and SQL `ORDER BY ev DESC`:

```sql
SELECT *, ev FROM activity_template
WHERE org_id = $org_id
  AND (input_shapes ALLINSIDE $available_shapes OR input_shapes IS EMPTY)
ORDER BY ev DESC
LIMIT $limit * 3;
```

The 9 JS heuristic boosts (shape-domain affinity, recency, goal-keyword match, etc.) are applied only to this pre-ranked set, not to the full corpus. The sort in JS becomes a re-rank over a small pre-filtered set rather than a full sort.

### Cache impact

The COMPUTED field is evaluated at read-time inside SurrealDB. It does not change the write path; `alpha` and `beta` are still the persisted fields. Redis cache TTL invalidation is unchanged. The cache stores serialised query results that include the COMPUTED `ev` value at the time of caching; on cache hit, `ev` is correct as of the last write before the cache entry was populated. This is the same staleness model as today (cached results may lag by up to 1hr TTL). No new cache invalidation logic is required.

---

## 4. P3: `fn::beta_sample` Stored Function

### Rationale

True Beta distribution sampling (`@stdlib/random-base-beta`) already exists at `activities.ts:4416`. This is correct Thompson Sampling — not EV-greedy. The goal of P3 is to move the sampling call into the DB layer so it can appear in `ORDER BY` clauses directly, enabling the DB to return a Thompson-sampled ranked list in one round trip instead of: fetch unranked candidates → sample in JS → sort in JS.

### Implementation (SurrealDB embedded JS)

```sql
DEFINE FUNCTION fn::beta_sample($a: float, $b: float) -> float {
  RETURN function($a, $b) {
    // Marsaglia & Tsang GD algorithm via Gamma samples.
    // Gamma(shape) via Cheng's rejection method.
    function gamma(shape) {
      if (shape < 1.0) {
        return gamma(1.0 + shape) * Math.pow(Math.random(), 1.0 / shape);
      }
      const d = shape - 1.0 / 3.0;
      const c = 1.0 / Math.sqrt(9.0 * d);
      while (true) {
        let x, v;
        // Box-Muller for standard normal
        const u1 = Math.random(), u2 = Math.random();
        x = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        v = Math.pow(1.0 + c * x, 3.0);
        if (v > 0.0 && Math.log(Math.random()) < 0.5 * x * x + d * (1.0 - v + Math.log(v))) {
          return d * v;
        }
      }
    }
    const gA = gamma($a);
    const gB = gamma($b);
    return gA / (gA + gB);
  };
};
```

After definition, queries can sort by Thompson sample directly:

```sql
SELECT id, name, alpha, beta,
       fn::beta_sample(alpha, beta) AS ts_score
FROM activity_template
WHERE org_id = $org_id
ORDER BY ts_score DESC
LIMIT $limit;
```

### Rollout plan

1. Deploy `fn::beta_sample` via migration.
2. **Dual-compute phase**: call both the DB function and `betaSample()` from `@stdlib`; log `sample_source` ("db" vs "app"). Compare output distributions over 1000 samples.
3. Once distributions match (KS test p > 0.05 on canary sample), remove the `@stdlib` call at `activities.ts:4416` and replace with the DB path.
4. Fallback: if DB function returns an error (e.g. SurrealDB upgrade removed the function), fall back to `betaSample()` from `@stdlib/random-base-beta`.

### Account attribution note

Like P1, every call to `fn::beta_sample` (or the app-side fallback) MUST happen in a query scoped to `WHERE account_id = $token.account_id`. The sampling draw is over that account's posterior — not a global posterior. This ensures Thompson Sampling selects activities based on outcomes the calling account has actually observed.

### Single insertion point

`activities.ts:4416` is the only site that calls `betaSample()` in the hot path. No other sites require changes.

---

## 5. P4: RELATE Edges for the Composition Graph

### Current state

The composition graph is stored in `activity_composition_graph` (join table) and `composition_impulse_flow` (per-impulse detail):

```
activity_composition_graph {
  parent_activity_id: string    // foreign key to activity_template
  child_activity_id:  string
  success_count:      int
  execution_count:    int
  weight:             float     // = success_count / execution_count
  // No α/β — these are derived in JS as alpha = success_count + 1, beta = exec - success + 1
}
```

The `discover-by-shapes` endpoint with 10 candidates issues **21 DB queries**:
- 1 query to fetch the candidate activity
- 10 queries for `variant_performance_metrics` (one per candidate)
- 10 queries for `activity_composition_graph` entries (one per candidate)

### RELATE edge attribution

`in` and `out` nodes on a `composes` edge may belong to different accounts — a composition path that sequences an Account X template followed by an Account Y template is valid when the executor's key includes scopes for both accounts. The `account_id` field on the edge records the executor's **issuing account** (who observed this composition path), not either template's account.

Posterior (α/β) updates on an edge are attributed to the executor's account. RELATE traversal filters on the executor's key scope set — not on `account_id` equality — because an executor with cross-account scopes legitimately sees edges whose `in`/`out` nodes span multiple accounts. Concretely: traversal queries MUST include a predicate that checks the executor's scope claims against the templates' account_id fields rather than requiring a single `account_id` match on the edge itself.

FC-3 (`share_learning = true` on a federation link) is the separate opt-in for one account's edge posteriors to seed another account's priors. It is orthogonal to execution scope grants and is not implemented in this proposal.

### Target: RELATE with α/β on edges

```sql
-- Edge definition
DEFINE TABLE composes SCHEMAFULL;
DEFINE FIELD alpha          ON TABLE composes TYPE float DEFAULT 1.0;
DEFINE FIELD beta           ON TABLE composes TYPE float DEFAULT 1.0;
DEFINE FIELD account_id     ON TABLE composes TYPE string;  -- executor's issuing account
DEFINE FIELD input_shapes   ON TABLE composes TYPE array<string> DEFAULT [];
DEFINE FIELD output_shapes  ON TABLE composes TYPE array<string> DEFAULT [];
DEFINE FIELD execution_count ON TABLE composes TYPE int DEFAULT 0;
DEFINE FIELD success_count   ON TABLE composes TYPE int DEFAULT 0;
DEFINE FIELD ev             ON TABLE composes COMPUTED alpha / (alpha + beta) TYPE float;

-- Creating an edge
RELATE activity_template:$a->composes->activity_template:$b
  SET alpha         = 1.0,
      beta          = 1.0,
      input_shapes  = $input_shapes,
      output_shapes = $output_shapes;

-- Updating edge posteriors (atomic)
UPDATE type::thing("composes", $edge_id)
  SET alpha += $da, beta += $db,
      execution_count += 1,
      success_count   += $success_delta;
```

### Shape-filtered Thompson traversal (21 queries → 1-2)

Traversal filters on the executor's key scope set, not `account_id` equality. `$accessible_account_ids` is derived from the executor's `ExecutionScope` — parsed in the activity-api auth middleware from the identity-vessel key validation response (`scopes: string[]`), not passed by the caller. It includes both the executor's own account and any cross-account scopes granted via active federation links. This means a key spanning Account X and Account Y scopes sees a unified subgraph containing templates from both.

```sql
-- ExecutionScope extracted from auth middleware context (not caller-supplied)
-- $primary_account_id = scope.primary_account_id
-- $accessible_account_ids = scope.accessible_account_ids
-- $granted_scopes = scope.scopes

-- Forward: find activities that consume $required_input_shapes and sort by Thompson sample
SELECT out.id, out.name, out.alpha, out.beta,
       fn::beta_sample(alpha, beta) AS ts_score
FROM activity_template:$start
  ->(composes
     WHERE (account_id = $primary_account_id
        OR (account_id INSIDE $accessible_account_ids
            AND scope INSIDE $granted_scopes))
       AND input_shapes CONTAINSANY $required_input_shapes
       AND output_shapes CONTAINSANY $required_output_shapes)
  ->activity_template
WHERE out.account_id INSIDE $accessible_account_ids
ORDER BY ts_score DESC
LIMIT 10;

-- Backward: find producers for a required shape
SELECT in.id, in.name,
       fn::beta_sample(alpha, beta) AS ts_score
FROM activity_template:$target
  <-(composes WHERE output_shapes CONTAINS $required_shape)<-activity_template
WHERE in.account_id INSIDE $accessible_account_ids
ORDER BY ts_score DESC
LIMIT 10;
```

`$accessible_account_ids` is never passed in by the MiniBob caller; it is read from the `ExecutionScope` context object attached by the auth middleware. No extra DB roundtrip is needed in the recommend handler.

This replaces approximately 90 lines of JS graph-traversal and join logic in `activities.ts`.

### Migration strategy

1. **Migration script**: Add RELATE edges from existing `activity_composition_graph` data. Each row becomes one `RELATE` statement with `alpha = success_count + 1`, `beta = execution_count - success_count + 1` (converting from frequentist counts to Beta prior).
2. **Dual-write**: for 1-2 weeks after migration, write to both `activity_composition_graph` and RELATE edges on each execution trace.
3. **Switch reads**: update `discover-by-shapes` to use the RELATE traversal query; run old and new paths in parallel and compare results for 3 days.
4. **Deprecate**: retire `activity_composition_graph` and `composition_impulse_flow` once query parity is confirmed.

### Query count comparison

| Operation | Before | After |
|---|---|---|
| `discover-by-shapes` (10 candidates) | 21 queries | 1-2 queries |
| Edge posterior update | 1 select + 1 update | 1 atomic update |
| Backward-chain producer lookup | 10 queries | 1 query |

---

## 6. P4.5: Shape Gap Index

The shape gap index is the system's memory of its own self-expansion. When the executor needs a shape and cannot find a template for it in its current key scopes, it triggers `create-shape-provider-goal`. The result — a new template that produces the shape — gets recorded in the gap index so the next occurrence of the same gap is resolved by reuse, not by re-running goal-seeking.

### Table definition

```sql
DEFINE TABLE shape_gap_resolution SCHEMAFULL;
DEFINE FIELD shape              ON TABLE shape_gap_resolution TYPE string;
DEFINE FIELD account_id         ON TABLE shape_gap_resolution TYPE string;       -- executor's issuing account
DEFINE FIELD resolved_by        ON TABLE shape_gap_resolution TYPE record<activity_template>;
DEFINE FIELD required_scope     ON TABLE shape_gap_resolution TYPE option<string>; -- null = own scope
DEFINE FIELD resolution_type    ON TABLE shape_gap_resolution TYPE string;
  -- 'local'               template was in own account scope
  -- 'federated'           template was accessible via cross-account scope grant
  -- 'goal_created'        no template existed; goal-seeking produced one
  -- 'scope_upgrade_needed' template exists but requires a federation link upgrade (human-actionable)
DEFINE FIELD escalation_depth   ON TABLE shape_gap_resolution TYPE int DEFAULT 0;
  -- number of recursive create-shape-provider-goal levels required
DEFINE FIELD cost_usd           ON TABLE shape_gap_resolution TYPE float DEFAULT 0.0;
DEFINE FIELD times_used         ON TABLE shape_gap_resolution TYPE int DEFAULT 1;
DEFINE INDEX shape_account_idx  ON TABLE shape_gap_resolution FIELDS shape, account_id;
```

### Lookup protocol

Before triggering `create-shape-provider-goal` escalation, the executor MUST query the gap index:

```sql
SELECT * FROM shape_gap_resolution
WHERE shape = $shape AND account_id = $account_id
ORDER BY times_used DESC LIMIT 1;
```

If a `goal_created` or `federated` entry is found and `resolved_by` still exists and is in scope:
- Attempt to execute `resolved_by` directly.
- Increment `times_used` on match.

If the entry has `resolution_type = 'scope_upgrade_needed'`, surface the gap to the human (workbench) rather than escalating automatically — it requires a federation link upgrade, not goal-seeking.

If no index entry exists, run goal-seeking. On completion, insert a new `shape_gap_resolution` row recording the outcome.

### Why this matters

Goal-seeking via `create-shape-provider-goal` can be expensive (multi-level recursive activity execution). The gap index converts the second occurrence of any gap from O(goal_seeking) to O(1 lookup + 1 execute). For shapes that recur frequently (e.g., `authenticated_user`, `project_config`), this is the primary cost reduction mechanism.

---

## 7. P5: BM25 Bound-Param Fix + HNSW Indexes

### Issue A — BM25 bound-parameter bug

**Location**: `paradigm.ts:998`

**Current code** (abridged):
```typescript
const bm25Query = `
  SELECT id, search::score(0) AS bm25_score
  FROM activity_template
  WHERE name @0@@ $query OR description @1@@ $query
  LIMIT ${limit}
`;
```

**Problem**: SurrealDB 3.0 rejects the `$query` bind parameter when used after `@N@@` BM25 operators. The query silently returns zero results for any parameterised search term. This is the same bug that affected `concept-db` and was fixed there on 2026-04-29.

**Fix**: inline the sanitised literal:
```typescript
// Strip BM25-unsafe characters; SurrealDB 3.0 BM25 accepts quoted literals
const safeQ = query.replace(/['"\\]/g, '').trim();
const bm25Query = `
  SELECT id, search::score(0) AS bm25_score
  FROM activity_template
  WHERE name @0@@ '${safeQ}' OR description @1@@ '${safeQ}'
  LIMIT ${limit}
`;
```

**Risk**: SQL injection via `safeQ`. Mitigation: strip `'`, `"`, `\` before interpolation. Input is always a goal string from an authenticated API caller; the strip is sufficient for this surface.

This fix is independent of the HNSW work (Issue B) and should ship first, since it unblocks Tier 3 search correctness for all users.

### Issue B — Dense search O(n) cosine scan

**Location**: `paradigm.ts:1103-1180`

**Current behaviour**: fetches all activity templates that have a non-null `name_embedding` or `description_embedding` field, scores each with cosine similarity in-process, sorts, and slices.

**HNSW infrastructure**: migration `041-vector-embeddings.surql` already defines a 1536-dim external HNSW index for a different field. The dense search uses a 384-dim embedding field that has no index.

**Fix**: add HNSW index and switch to `<|k,ef|>` KNN operator:

```sql
-- Migration
DEFINE INDEX activity_name_embedding_hnsw
  ON TABLE activity_template
  FIELDS name_embedding
  HNSW DIMENSION 384 DIST COSINE EFC 150 M 16;

DEFINE INDEX activity_desc_embedding_hnsw
  ON TABLE activity_template
  FIELDS description_embedding
  HNSW DIMENSION 384 DIST COSINE EFC 150 M 16;
```

```typescript
// After: O(log n) KNN
const denseQuery = `
  SELECT id,
         vector::similarity::cosine(name_embedding, $q_vec) AS score
  FROM activity_template
  WHERE name_embedding <|${k},${ef}|> $q_vec
`;
```

### Hybrid search (BM25 + HNSW via RRF)

After both fixes, Tier 3 hybrid search becomes:

```sql
LET $fts = (
  SELECT id FROM activity_template
  WHERE name @0@@ '${safeQ}' OR description @1@@ '${safeQ}'
  LIMIT 20
);
LET $vec = (
  SELECT id FROM activity_template
  WHERE name_embedding <|20,200|> $q_vec
);
RETURN search::rrf([$fts, $vec], 10, 60);
```

This matches the SurrealDB `search::rrf()` signature: `(result_sets, limit, k)` where `k = 60` is the standard RRF constant.

### Rollout

- P5A (BM25 fix) ships first: zero-risk, pure bug fix, no migration.
- P5B (HNSW) ships behind `DENSE_EMBEDDING_HNSW_ENABLED=true` env var initially. Building the HNSW index on an existing corpus takes time proportional to corpus size; gate behind the flag so canary deployment is not blocked by index construction time.

---

## 7. Rollout Order and Dependencies

```
P1 (atomic updates)          — no dependencies, ship first
  ↓
P5A (BM25 bug fix)           — no dependencies, ship second (unblocks search correctness)
  ↓
P2 (COMPUTED ev field)       — requires P1 deployed (α/β now reliable)
  ↓
P3 (fn::beta_sample)         — requires P2 deployed (COMPUTED ev provides fallback ORDER BY)
  ↓
P4 (RELATE edges)            — requires P3 deployed (fn::beta_sample available in traversal queries)
  ↓
P5B (HNSW indexes)           — independent of P1-P4; gate behind env var
```

Each phase ships to canary independently. A phase rollback does not require rolling back a prior phase.

---

## 8. What Stays Application-Side

The application layer retains:

- Multi-tier fallback logic (Tier 1 SQL → Tier 2 pattern-match → Tier 3 hybrid search)
- 9 heuristic boost calculations in the recommend endpoint (`shape_domain_affinity`, `recency_boost`, `goal_keyword_match`, etc.)
- Redis cache invalidation (TTL-based; unchanged)
- Multi-tenant org scoping in query predicates
- Composition of Thompson-sampled candidate sets into a final ranked response
- Error handling and graceful degradation when DB functions are unavailable

The principle: deterministic and RL-model computations move to DB; domain heuristics and multi-tier orchestration stay in app.

---

## 9. Observability

**P1**: log `atomic_update: true` on each posterior write. Canary validation: before/after comparison of posterior values under concurrent load (N concurrent execution traces for same template, compare final α/β sum against expected sum).

**P2**: log `ev_computed_field: true` when the COMPUTED field is available in query results. Fall back to JS `alpha/(alpha+beta)` if the field is absent (handles canary/production version skew window).

**P3**: log `sample_source: "db" | "app"` on every Thompson sampling call. Track p-value of KS test between DB and app distributions on canary. Promote once `p > 0.05` over 1000 samples.

**P4**: log `edge_query_count` per `discover-by-shapes` call. Canary validation: query count drops from ~21 to ≤2 after RELATE migration.

**P5A**: log `bm25_result_count` per Tier 3 search call. Validation: count should be non-zero for any non-empty query string after fix.

**P5B**: log `dense_search_latency_ms` and `dense_search_method: "hnsw" | "scan"`. Benchmark at corpus sizes 100, 1000, 10000 templates to quantify O(log n) improvement.

---

## 10. Federation and RL scoping

Federation in this system is **scope delegation embedded in keys at issuance time**. A federation link is a one-time scope grant: Account X grants Account Y's vessels a specific set of scopes (`account_X:project_P:developer`, `account_X:templates:execute`, etc.). Account Y's identity-vessel embeds these scopes into the keys it issues. When Account Y's vessel calls activity-api, it presents a key that already carries Account X's scopes — the RBAC check is purely `key.scopes CONTAINS required_scope`. There is no runtime identity federation, no cross-boundary proxy.

**Consequence for the RL layer:**

- The composition graph visible to an executor is the subgraph reachable via its current key scopes. A key spanning Account X and Account Y scopes sees a unified graph containing templates from both. Account boundaries in the graph do not correspond to topology boundaries; scope grants do.
- `$accessible_account_ids` in traversal queries is derived from the executor's `ExecutionScope`, which is parsed in the activity-api auth middleware from identity-vessel's key validation response (`scopes: string[]`). The middleware attaches `ExecutionScope` to the Hono context; handlers read it without a second identity-vessel roundtrip. Identity-vessel MUST include `scopes: string[]` in its `POST /v1/keys/validate` response for this derivation to work.
- Posterior updates on edges and nodes are attributed to the executor's issuing account (the account whose identity-vessel issued the key). Thompson Sampling for each account learns from its own observed outcomes.
- **FC-3 (`share_learning = true`)** is the explicit opt-in for cross-account learning: when set on a federation link, the granting account's posteriors are seeded into the grantee's priors. This is entirely orthogonal to execution scope grants — an account can grant full execution scope without sharing its learned posteriors, and vice versa. FC-3 is out of scope for this proposal; it is documented here to prevent scope creep.

**Practical implication for P4:** the `composes` edge `UNIQUE(in, out)` uniqueness constraint only makes sense within an account's observed subgraph. Two accounts observing the same composition path independently each have their own edge record with their own α/β. The unique index MUST be `UNIQUE(in, out, account_id)` so cross-account observations do not collide or overwrite each other's posteriors.
