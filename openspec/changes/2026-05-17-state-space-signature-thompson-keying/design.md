# Design — State-Space-Signature Thompson Keying

## Foundation note

This change does not introduce a new substrate; it changes what an existing substrate **means**. The `context_thompson_scores` table (`repos/metabob-activity-api/sql/migrations/088-context-thompson-scores.surql`) was added under the `context-bucketed-thompson-sampling` capability and is currently written by two paths:

- `execution-traces.ts:2403-2533` — derives a `context_bucket` from `body.metadata.context_bucket` or re-derives it via `computeContextBucket(taskDesc, input_impulse_shapes, orgId)` (`session-context.ts:115-129`), then atomically increments α/β.
- `posterior-update.ts:220-286` — `writeAncestorDelta` writes the same bucket to ancestors during chain-credit propagation.

The recommend read path (`activities.ts:4397-4400`) computes the bucket at request time but **never queries the table**. It is a write-only surface today. The recommendation algorithm ranks by `variant_performance_metrics.thompson_alpha / (alpha + beta)` (`activities.ts:443-562`), multiplied by `applyCompatibilityFilter`'s discount (`recommendation.ts:74-131`). The Phase 18 description in `2026-04-26-impulse-activity-loop/tasks.md:902` calls this surface "the bucketed posterior surface that 18.4 writes through when available" — i.e., 18.4 explicitly defers the read-path activation. This change activates the read path.

This is the difference between *memorising identity* (template X is good) and *learning behaviour* (template X is good when the pool already contains shapes A,B and is missing shape C). The first is a sufficient statistic only if the marginal over contexts is what we want to recommend on. It isn't — at recommend time we know the context.

---

## 1. The signature

### What it is

A `state_space_signature` is a deterministic, versioned, low-collision hash over the binding-time context of an execution. It is computed identically on minibob (write path) and on activity-api (read path), is stable across pod restarts, and is bounded in length (16 lowercase hex chars = 64 bits of address space).

### Composition

```
state_space_signature_v1 = hex(sha256(
  signature_version
  || "|"
  || sorted-join(shape_multiset)
  || "|"
  || sorted-join((shape, producedBy?) tuples)
  || "|"
  || sorted-join(missing_shapes)
))[:16]
```

Components:

| Component                                | Source (write path)                                                                                      | Source (read path)                                                                          |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `signature_version`                      | const `1`                                                                                                | const `1`                                                                                   |
| `shape_multiset`                         | `presentShapesPre` from `lifecycle:task:preBinding` payload (minibob `activity.ts`) plus per-task `input_impulse_ids` mapped to shapes via `impulses_by_id` | `impulse_state_space[*].shape` from the recommend body (`activities.ts:4397`)               |
| `(shape, producedBy?)` provenance tuples | `impulse.metadata.producedBy` or `produced_at_task_id` (Phase 20 plumbing; `shape-resolver.ts:20-27`)    | `impulse_state_space[*].pointer.producedBy` when present; absent components elided          |
| `missing_shapes`                         | `missingShapesPre` from `lifecycle:task:preBinding`                                                      | derived from `blocking_shapes` returned by `identifyBlockingShapes` (`recommendation.ts:222`) |

`sorted-join` is `arr.slice().sort().join(",")` — case-sensitive, no trimming. The multiset is encoded by repeating elements (e.g., `["file","file","jwt_claims"]` → `"file,file,jwt_claims"`); this matters because two `file` impulses bound to two different slots are not the same state as one `file` impulse. Provenance tuples without `producedBy` are written as `"shape:"` (trailing colon, empty rhs) so absence is a stable marker rather than a missing token.

The 16-char truncation gives 2^64 collisions; at 200 distinct signatures per template and ~3k templates, the expected collision rate is ~10⁻¹³.

### Why this composition (rejected alternatives)

| Candidate                                                   | Discrimination          | Cardinality   | Rejection reason                                                                                                                                                                          |
| ----------------------------------------------------------- | ----------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sorted shape **set** (today's bucket)                       | low                     | low (~100s)   | A pool with two `file` impulses behaves differently from one. Multiset matters. Also misses the missing-shape signal that drives slot-binding behaviour.                                  |
| Sorted shape multiset only                                  | medium                  | low (~1000s)  | Misses provenance: a `jwt_claims` impulse produced by identity-vessel vs. a `jwt_claims` produced by a forge activity have different downstream success rates. Phase 20 surfaces this.    |
| Multiset + provenance + missing                             | **chosen**              | medium (~10⁴) | Captures the three observable axes of binding context the system already records. Coarse-bucket collapse handles long-tail.                                                               |
| Full per-impulse-ID hash                                    | high                    | unbounded     | Every execution gets its own bucket; learning never converges. Not useful.                                                                                                                |
| Multiset + goal-cluster (today's `computeContextBucket`)    | medium                  | medium        | Goal cluster is informative but is a **derived** signal — the same shapes-with-different-goal often imply different bindings. We keep `goal_cluster` as an *orthogonal* secondary key for future work, not as part of v1. |
| Multiset + goal-cluster + provenance + missing (everything) | highest                 | high (~10⁵+)  | Doubles cardinality vs. chosen for marginal discrimination gain. Long-tail collapse becomes the dominant code path. Defer to v2 if the harness flags the chosen variant as undershooting. |

The choice is "cover the three pre-binding signals already plumbed; leave goal-cluster orthogonal because Phase 18.4's harness will tell us whether it pays for itself."

### Versioning

`signature_version` is the first hashed token, so v1 and v2 signatures never collide even on identical inputs. The migration adds `signature_version: int DEFAULT 0` to `context_thompson_scores`. Legacy 8-hex `context_bucket` rows are version 0 (computed by today's `computeContextBucket`). New rows are version 1. Reads filter on `signature_version = 1` first; on miss, fall through to the template-level row (not to v0 rows — they encode a different equivalence and would corrupt the prior).

When a v2 ships, v1 rows are not migrated. They age out by the cardinality-collapse rule (§5). The cost of keeping v0/v1/v2 separate is one extra column in the index — no SQL rewrite, no backfill.

---

## 2. Schema

### Migration

`repos/metabob-activity-api/sql/migrations/130-state-space-signature.surql` (sequence number TBD at apply time — 130 is the next free slot after migration 129 from 2026-05-15):

```sql
-- Add signature_version column; default 0 covers all extant 8-hex rows.
DEFINE FIELD IF NOT EXISTS signature_version
  ON context_thompson_scores
  TYPE int
  DEFAULT 0;

-- Index supports the read-path lookup keyed on (org, template, version, signature).
DEFINE INDEX IF NOT EXISTS idx_ctx_ts_versioned
  ON context_thompson_scores
  FIELDS org_id, template_id, signature_version, context_bucket;
```

No `REBUILD INDEX` required; `idx_ctx_ts_bucket` and `idx_ctx_ts_template` from migration 088 remain in place for the v0 read path during the transition. The new index is additive.

### Trace metadata

Minibob's trace POST body grows one optional field at `body.metadata.state_space_signature: string` (16 lowercase hex). When present, activity-api uses it directly instead of re-deriving — the goal is byte-identity between write-time and read-time signatures, and the re-derivation path in `execution-traces.ts:2480-2482` is a safety net for traces written by older minibobs.

The trace also carries `body.metadata.signature_version: int` so the write path can route to the correct row.

---

## 3. Read path

### Pseudocode

```typescript
// activities.ts /v2/activities/recommend, after fetching candidate templates
const signature = computeStateSpaceSignatureForRequest(
  impulse_state_space,     // from request body
  blocking_shapes,         // from identifyBlockingShapes output
);

const conditional = await lookupConditionalPosterior({
  templateIds: candidateTemplateIds,
  signature,
  signatureVersion: 1,
  orgId,
  db: surrealDB,
});
// conditional: Map<templateId, { alpha, beta, n_observations } | null>

const adjustedTemplates = candidates.map((t) => {
  const cond = conditional.get(t.id);
  if (cond && cond.n_observations >= SIGNATURE_SAMPLING_FLOOR) {
    return { ...t, alpha: cond.alpha, beta: cond.beta, _posterior_source: 'conditional' };
  }
  return { ...t, _posterior_source: 'template' };
});

// Then applyCompatibilityFilter as today, but reading the adjusted alpha/beta.
```

### Sampling floor

`SIGNATURE_SAMPLING_FLOOR = 5` (configurable via `RECOMMEND_SIGNATURE_SAMPLING_FLOOR` env var). Below 5 observations the conditional posterior is noisier than the marginal; the empirical Bayesian intuition is that a Beta(1,1) prior with 5 observations gives a CI half-width of ~0.4, which is wider than the typical inter-template gap in the recommend pool. Bumping the floor to 10 would be defensible but reduces the fraction of requests served by the conditional path; 5 is the lowest floor that empirically stays above noise in the discrimination test (§7).

Rationale for fall-through to the template row rather than to a coarser signature: the coarse-bucket collapse (§5) writes back to the same table, so by the time the floor matters there is no coarser bucket to fall through to — the row either has enough samples to be the conditional, or it has been collapsed and the entries are now under a different signature. Falling back to `variant_performance_metrics` skips the intermediate ambiguity.

### Cache

`context_thompson_scores` lookups by `(org_id, template_id, signature_version, context_bucket)` are bounded — at most 200 candidate templates per request × 1 signature. A 5-second LRU keyed on the same tuple lives in the recommend handler's request-scoped cache (modeled on the per-request `CompositionChainCache` referenced in CLAUDE.md). No Redis layer in v1.

---

## 4. Write path

### Trace-write

`execution-traces.ts:2403-2533` already has the bucketed write — extended to:

1. Read `body.metadata.state_space_signature` and `body.metadata.signature_version`. If absent, derive both server-side from `body.input_impulse_shapes` and any predicate metadata on `body.impulses_by_id` (preserving back-compat with current bodies).
2. Write to `context_thompson_scores` with `signature_version = N` and `context_bucket = signature`. The existing LET/IF/CREATE pattern stands; the `signature_version` column is added to the WHERE and to the CREATE payload.
3. The legacy 8-hex bucket continues to be computed and written with `signature_version = 0` for one release cycle. After two weeks of v1 traffic, the legacy write is removed in a follow-up.

### `applyOutcomeToPosteriors`

`posterior-update.ts:388-475` already accepts a `context_bucket`. The extension:

- Accept `signature` + `signature_version` instead of (or in addition to) `context_bucket`. During the transition both are accepted; internally the function uses the versioned pair.
- Failure-mode stratification (Phase 18.3) applies per-bucket identically to today. `verifier_negative` → conditional β += 1 *and* `variant_performance_metrics` β += 1. The two posteriors are kept in lockstep.

### Chain-credit (Phase 18.4)

`propagateCreditAlongChain` (`posterior-update.ts:303-371`) today is called with the *leaf execution's* `context_bucket` (`posterior-update.ts:308`, passed through to `writeAncestorDelta:369`). This is wrong: ancestor B's binding context is its **own** `presentShapesPre` at the moment it dispatched its child, not the leaf's pool at task time.

Fix: extend `ExecutionForChainCredit` with `ancestor_signatures: Record<execution_id, { signature, signature_version }>`. Minibob emits these as part of the leaf's composition_chain payload — each ancestor execution_id maps to that ancestor's own pre-binding signature, captured when the ancestor's `lifecycle:task:preBinding` fired. The ancestor-signature record is bounded by `composition_chain.length` (capped at 16 by Phase 18.4 cycle guard).

When `ancestor_signatures` is absent (legacy traces, browser-initiated executions), `propagateCreditAlongChain` falls back to template-level writes only (no conditional-bucket write for ancestors). This is the correct degraded behaviour: noisy credit attribution at the conditional level is worse than no credit at the conditional level.

---

## 5. Cardinality control

### The problem

A naive multiset+provenance+missing signature has high cardinality in the long tail. Suppose a template typically runs with 5 of 10 possible input shapes; that's `C(10,5) = 252` possible shape sets, multiplied by the cardinality of `producedBy` values, multiplied by the missing-shape set. Easily 10⁴ distinct signatures per template; > 99 % of them with n=1.

### The strategy

Three tiers, with a daily background job:

1. **Conditional (v1, full signature)** — n ≥ `SIGNATURE_SAMPLING_FLOOR`. Used by the read path.
2. **Coarse (v1c)** — fall back to a coarser hash that strips `producedBy` and `missing_shapes`, keeping only the shape multiset. A row is "coarse-promoted" when its v1 signature has had n < `SIGNATURE_SAMPLING_FLOOR` for ≥ 30 days; the daily job sums α and β across all such v1 rows under the same template and emits a single v1c row. The v1 rows are then deleted.
3. **Template (`variant_performance_metrics`)** — the read-path fallback when no v1 or v1c row meets the sampling floor.

The daily job is a single SurrealQL script:

```sql
-- Pseudocode; production version handles tenancy + paging
LET $stale = SELECT template_id, context_bucket
  FROM context_thompson_scores
  WHERE signature_version = 1
    AND n_observations < $floor
    AND last_updated_at < time::now() - 30d;

-- For each stale row, compute v1c hash from the trace metadata that
-- produced it (replay-from-metadata, not from the bucket itself; the bucket
-- is one-way).
-- Sum α, β into the v1c row; delete v1 rows.
```

The v1c hash is computable from the same trace metadata as v1 — we don't reconstruct it from the bucket. This means the background job must read at least one representative trace per stale bucket; that's bounded by the number of stale buckets, not by trace volume.

### Cap

Hard cap of 200 distinct signatures per `(org_id, template_id, signature_version)`. When the cap is exceeded, new signatures fall through to template-level writes until the daily job collapses the long tail. This is a safety valve, not the main control.

---

## 6. Worked example

Consider template `dispatch-and-validate` (a Phase 20 slot-binding-heavy template) with `total_observations = 84`.

**Scenario A** — pool contains `[goal, file, jwt_claims]` with `jwt_claims.producedBy = identity-vessel-resolve`, no missing shapes. After 22 executions: 20 success, 2 verifier_negative. α = 21, β = 3, success rate 91 %.

**Scenario B** — pool contains `[goal, file, jwt_claims]` with `jwt_claims.producedBy = forge-jwt-validator` (Phase 22 forged vessel), no missing shapes. After 7 executions: 1 success, 6 verifier_negative. α = 2, β = 7, success rate 22 %.

**Marginal posterior** (`variant_performance_metrics`): α = 23, β = 10, EV = 0.70 — recommends the template with mild confidence regardless of which `jwt_claims` is in the pool.

**Conditional posteriors**:
- Signature A: EV = 0.875. Surfaces the template strongly when the well-behaved producer is present.
- Signature B: EV = 0.22. Suppresses the template when the forge producer is present — exactly the signal a topology-learning system should propagate back as feedback into Phase 22's forge calibration.

The marginal is a lie. The conditional is the truth. Discrimination test result for this template: Welch t-test on the two empirical success rates with n₁=22, n₂=7 → t ≈ 4.2, p < 0.001 — well below the 0.05 threshold required by Success Criterion 3.

---

## 7. Discrimination test (the load-bearing acceptance criterion)

### The metric

For each template with `Σ n_observations ≥ 50` across all conditional rows: pick the two highest-population signature buckets; perform a two-sided Welch t-test on the empirical success rates (Bernoulli, so variance = p(1-p)/n). Count templates with `p < 0.05`.

### The threshold

≥ 25 % of qualifying templates must show `p < 0.05` between their top-two buckets. Rationale: even if conditional keying perfectly captured context, not every template would show heterogeneity — some templates are genuinely robust across contexts. 25 % is the floor at which the signature is recovering more structure than would be expected by chance under a null model where contexts are noise (simulated null with shuffled context labels at the same n-distribution: < 5 % of templates show p < 0.05).

### How it is computed

A new section in `validation/scripts/reuse-harness.ts`:

```typescript
async function computeDiscriminationStat(): Promise<DiscriminationReport> {
  // Pull all (template_id, alpha, beta, n_observations) from
  // context_thompson_scores via /v2/impulses/resolve (new shape: contextThompsonScores).
  // Bucket by template_id, filter to templates with sum(n_observations) >= 50.
  // For each, find top-two by n_observations; Welch-t-test.
  // Report: total_qualifying_templates, discriminating_templates, fraction.
}
```

The report is emitted as `discrimination_report` in the weekly harness JSON (`validation/results/YYYY-MM-DD-reuse-report.json`). The regression gate in `.github/workflows/weekly-recommendation-validation.yml` (created in Phase 19) adds one more rule: `discriminating_fraction` must not drop > 0.05 week-over-week once the conditional path has been live for ≥ 14 days.

### What the test does NOT do

It does not prove the recommender ranks better. It proves the **signal** is there to be ranked on. Whether the rank order improves is captured by Success Criterion 4 (recommend_mrr non-regression). The two criteria are complementary: discrimination without ranking gain means the rank function is ignoring the signal; ranking gain without discrimination means we got lucky on this benchmark. Both are required.

---

## 8. Backward compatibility

| Scenario                                                       | Behaviour                                                                                                                                                                                              |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Trace POST with no `metadata.state_space_signature`            | Server derives v1 signature from `body.input_impulse_shapes` if present; otherwise no conditional write. Template-level write proceeds as today.                                                       |
| Recommend POST with no `impulse_state_space`                   | No signature is computed; template-level posterior is used. No new fields in response. Identical to today.                                                                                             |
| Recommend POST with `impulse_state_space` but no `blocking_shapes` returned (because none were missing) | Signature includes empty `missing_shapes` token. Conditional row keyed on a signature where `missing_shapes` is empty — distinct from a request that had no `impulse_state_space` at all.              |
| Legacy v0 rows (8-hex `context_bucket`, `signature_version = 0`) | Continue to receive writes for one release cycle alongside v1 writes; never read by the new read path. Aged out by the daily job (any row with `signature_version = 0` and `last_updated_at < time::now() - 60d` is deleted). |
| Trace with `composition_chain` but no `ancestor_signatures`    | Chain-credit propagation writes to `variant_performance_metrics` only (no conditional write for ancestors). Logged at `debug`, not `warn` — common during transition.                                  |

---

## 9. Interaction with `recommendation-validation-v2`

The Phase 19 harness already separates `search_mrr` from `recommend_mrr` and emits behavioural health signals. This change adds two outputs:

1. **`discrimination_report`** — described in §7.
2. **`conditional_coverage`** — for each harness benchmark entry, record whether the recommend call used a conditional posterior (`_posterior_source = 'conditional'`) or fell through to template (`_posterior_source = 'template'`). The aggregate `conditional_coverage_fraction` should trend upward as more traces accumulate per signature; a flat or declining trend after 7 days indicates the signature scheme is too fine-grained.

The harness re-uses its existing 30-entry benchmark; no new benchmark curation is required. Where the harness today reports `recommend_mrr_overall`, post-change it additionally reports `recommend_mrr_conditional_only` (subset where the conditional path fired) and `recommend_mrr_template_only` (subset that fell through). If the conditional subset's MRR is lower than the template subset's, we have evidence the signature is hurting ranking — actionable feedback, not just a number.

---

## D1. Open questions

**Q1**: Goal-cluster orthogonality. Today's `computeContextBucket` mixes shape + goal-cluster + org into one hash. v1 drops goal-cluster from the signature; the question is whether to re-introduce it as a *secondary* key (a second column on `context_thompson_scores`, indexed jointly). The discrimination test in §7 will answer this empirically: if Welch-t finds < 25 % discriminating templates, the goal-cluster axis is the first thing to add.

**Q2**: Provenance granularity. `producedBy` today is a string — either a vessel id (`identity-vessel-resolve`) or a task id from a prior dispatch. Mixing these in one signature axis means two pools that resolved `jwt_claims` from the same vessel via different task ids get different signatures. This may be over-discriminating. A follow-up could normalise `producedBy` to "vessel id or `task` literal" — losing per-task identity but compressing the long tail. Defer until the cardinality data is in.

**Q3**: Cross-org signature sharing. Signatures are deterministic and contain no org-private data. Two orgs running the same template against the same shapes would compute identical signatures. Today's `context_thompson_scores` is org-scoped via PERMISSIONS — each org has its own row even at identical signatures. This is correct (success rates differ across orgs) but inefficient (cold-start a new org never sees another org's prior). A future change might add a "system-level prior" row that any org can fall back to before the template-level row; out of scope here.

**Q4**: Signature on the read path when `blocking_shapes` is large. If every recommend response includes a `missing_shapes` token derived from a varying `blocking_shapes` set, the read-time signature thrashes across requests for the same user in the same session. Mitigation: at read time, *only include in `missing_shapes`* those shapes that are required-by the top-5 templates (which `identifyBlockingShapes` already returns) — not the union over all candidates. This means the read-time signature is stable across consecutive recommends as long as the top-5 set is stable, which it usually is.
