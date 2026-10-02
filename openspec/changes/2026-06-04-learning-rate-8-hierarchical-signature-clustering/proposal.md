# Proposal: Hierarchical Signature Clustering via Dense Embedding (Learning-Rate Mechanism 8)

## Why

The substrate is a factored Bayesian Q-learning MDP over the
`(state_signature, template_id)` lattice (`docs/architecture/SUBSTRATE_AS_MDP.md`
§1–§3). For each cell it maintains a Beta(α, β) posterior over
P(success | s, a) and selects via Thompson sampling. Per-cell update is the
Bernoulli–Beta conjugate step at
`repos/metabob-activity-api/src/lib/posterior-update.ts:540` (v1 conditional
write, signature-keyed) and `:311` (chain-credit duplicate).

**The bottleneck this mechanism attacks: samples per cell.**

`context_thompson_scores` is keyed by `(org_id, template_id, signature_version,
context_bucket)` where `context_bucket` is the full state signature
(`posterior-update.ts:543-544`). Signatures today are content hashes — each
distinct pool of impulse shapes is a distinct bucket, and the bucket cardinality
grows unboundedly with the impulse-shape lattice. Empirically, the
`context_thompson_scores` table has ~3k rows (see
`repos/metabob-activity-api/src/utils/session-context.ts:126`), and across the
live concept graph "only one concept currently has non-zero empirical
success/failure signal" (`concept_learning_currently_cold_start_dominated`,
2026-06-01). Most cells will never see a second sample under the current
keying — Thompson sampling on Beta(1, 1) is uniform random.

The substrate already has the machinery to fix this: concept-db's MiniLM ONNX
embedding service (`repos/concept-db/src/services/embedding.ts:214`,
`all-MiniLM-L6-v2`, 384-dim) plus a dense cosine-similarity scan over stored
embeddings (`repos/concept-db/src/resolvers/concept.ts:550–620`,
`searchConceptsByDense`). The same dense kernel can be applied to state
signatures themselves: cluster signatures by embedding similarity, maintain a
posterior at the cluster level too, and let the selector consume the cluster
posterior until the per-signature cell crosses a confidence threshold.

`concept_skw2SmuLHZlN` (`hierarchical_signature_clustering_via_dense_embedding`,
parent `concept_TbN0eSf7U_hM` = `learning_rate_improvement_mechanisms`) is the
substrate's own articulation of this mechanism. This proposal makes it real.

## Discipline alignment (concept_7mzv7SQN_7JB)

This change introduces **no new primitives, no new tier, no new vocabulary**.

- **Impulse**: signatures are already impulses (shape-set hashes of the pool).
  Their embeddings are derived impulses — same shape as concept embeddings.
- **Activity**: prior-seed lookup runs inside the existing posterior-update
  activity. No new entry in the activity registry.
- **Signature**: keying is unchanged at the leaf — `(org_id, template_id,
  signature_version, context_bucket)`. The cluster id is a *function of* the
  signature, not a new identifier the substrate has to reason about.
- **Thompson-per-arm**: the Beta posterior is unchanged. We add a *second* Beta
  at cluster granularity. The selector uses whichever is more confident.

**This is not a new tier.** `SUBSTRATE_AS_MDP.md §4.2` already describes scope
ordering (org → account → global) as a Bayesian hierarchical model where the
narrower scope refines the broader scope's posterior as a prior:

$$
P_{\text{org}}(\text{success} \mid s, a) = \text{Beta}\big(\alpha_{s,a}^{\text{global}} + n_{\text{org,succ}},\ \beta_{s,a}^{\text{global}} + n_{\text{org,fail}}\big)
$$

The "scope ordering" comment at
`repos/metabob-activity-api/src/routes/impulses.ts:1410` is the exact
partial-pooling rule. `concept_AIh9mrDEZcmJ` (`computed_thompson_scores`) names
the existing axis: org/account/global.

This proposal adds **another axis** on the same partial-pooling pattern, on a
*similarity* metric instead of an *administrative* metric. The shadowing rule
is identical; only the parent kernel changes:

| Existing axis (`§4.2`) | New axis (this proposal) |
|---|---|
| Parent = `scope = 'global'` rows | Parent = `cluster_id` rows |
| Refinement = `org_id = $token.org_id` | Refinement = `signature = $sig` |
| Kernel = administrative containment | Kernel = embedding cosine similarity |
| Shadowing trigger = "org has any rows" | Shadowing trigger = `n_signature ≥ n_min` |

The math is the same conjugate update. The discipline check
(`concept_7mzv7SQN_7JB`) is satisfied: we re-stated the new mechanism under the
existing primitive (`scope = parent posterior, refined by child samples`),
without inventing a fifth tier or a new resolver category.

## Math

Let $c(s)$ denote the cluster id for signature $s$ — a function from the dense
embedding $e(s) \in \mathbb{R}^{384}$ to an integer cluster label assigned by
the clustering pass (§Clustering algorithm below). For each
$(template, signature\_version, cluster\_id)$ cell, maintain a
Beta posterior $(\alpha_C, \beta_C)$. For each
$(template, signature\_version, signature)$ leaf cell, maintain
$(\alpha_s, \beta_s)$ exactly as today.

**Update rule (cluster level, on observed outcome at signature $s$):**

$$
\alpha_C \mathrel{+}= \Delta\alpha, \quad \beta_C \mathrel{+}= \Delta\beta
$$

with the same stratified $(\Delta\alpha, \Delta\beta)$ already used at the leaf
(`posterior-update.ts:540–550`). The cluster row absorbs every signature-leaf
update inside the cluster. After $N$ observations spread across $K$ signatures
in cluster $C$, the cluster posterior has:

$$
\alpha_C + \beta_C \approx 2 + N, \qquad \alpha_s + \beta_s \approx 2 + N/K
$$

The cluster posterior accumulates evidence $K\times$ faster than any single
signature inside it. This is the rate gain.

**Selector rule (Thompson sample at request time):**

At read for signature $s$ under template $t$:

- if $n_{s,t} \;\triangleq\; (\alpha_s + \beta_s - 2) \geq n_{\min}$: sample
  $\theta \sim \text{Beta}(\alpha_s, \beta_s)$ (use leaf posterior — confident).
- else: sample $\theta \sim \text{Beta}(\alpha_{c(s),t}, \beta_{c(s),t})$ (use
  cluster posterior — shadowed).

This is **identical in form** to §4.2:

$$
P_{\text{signature}}(\text{success}) =
\begin{cases}
\text{Beta}(\alpha_s, \beta_s) & n_s \geq n_{\min} \\
\text{Beta}(\alpha_C, \beta_C) & n_s < n_{\min}
\end{cases}
$$

substituting `(global, org)` for `(cluster, signature)`. The substrate's
existing org/account/global selector code at
`repos/metabob-activity-api/src/routes/impulses.ts:1404–1422` is the template:

```
let rows = await executeAsAuth<any>(jwtAuthCtx, orgQuery, params);   // narrow
if ((rows[0]?.total_executions ?? 0) > 0) { resolvedScope = ... }
else { /* fall back to globalQuery */ }
```

becomes, on the similarity axis:

```
let rows = await executeAsAuth<any>(jwtAuthCtx, signatureQuery, params);
if ((rows[0]?.total_executions ?? 0) >= n_min) { resolvedScope = 'signature' }
else { /* fall back to clusterQuery on cluster_id = c(sig) */ }
```

The two axes compose: a request resolves first by org → cluster → global. Each
hop is the same partial-pooling rule; only the kernel changes.

## Existing surface (file-level grounding)

| File | Line(s) | What's there today |
|---|---|---|
| `repos/metabob-activity-api/src/lib/posterior-update.ts` | 540–550 | Leaf CREATE on `context_thompson_scores`, signature-keyed |
| `repos/metabob-activity-api/src/lib/posterior-update.ts` | 311–316 | Chain-credit duplicate of leaf CREATE |
| `repos/metabob-activity-api/src/lib/posterior-update.ts` | 518–538 | v1 conditional write — selects + UPDATE-or-CREATE path |
| `repos/metabob-activity-api/src/routes/impulses.ts` | 1395–1450 | Existing partial-pooling selector (org → global) — template for cluster → signature |
| `repos/metabob-activity-api/src/utils/session-context.ts` | 126 | `~3k context_thompson_scores rows` — current bucket cardinality |
| `repos/concept-db/src/services/embedding.ts` | 214 | MiniLM ONNX embedder (384-dim) — reuse for signature embedding |
| `repos/concept-db/src/resolvers/concept.ts` | 550–620 | `searchConceptsByDense` cosine-similarity scan — pattern to reuse |
| `repos/concept-db/src/resolvers/concept.ts` | 599–605 | `content_embedding?.length === 384` guard — schema for embedding columns |
| `repos/metabob-activity-api/src/routes/impulses.ts` | 3460–3500 | `context_thompson_scores` paginated read — augment with `cluster_id` field |

There is **no existing signature-clustering surface**. Search for
`signature_cluster|cluster_id|hdbscan|agglomerative` across `repos/` returns
nothing in source code (matches are unrelated `fast_hdbscan` mock fixtures in
the dashboard repo). This is greenfield on the activity-api side, reusing
concept-db's embedder.

## Clustering algorithm choice

Three candidates against the substrate's signature-volume scale (~3k rows now,
projected ~30k after federation §27.S.6):

| Algorithm | Pros | Cons | Verdict |
|---|---|---|---|
| **k-means** | O(nkd), cheap, scikit-style available in JS | Requires k upfront; assumes spherical clusters; signatures form long-tail mass | Reject — pre-committing k contradicts the open-world MDP framing |
| **HDBSCAN** | Density-based; auto-selects cluster count; handles noise points (outliers stay un-clustered); robust to long-tail | Heavier (O(n log n) typical); `min_cluster_size` knob; noise points fall back to leaf-only posterior — fine | **Accept** |
| **Hierarchical agglomerative (Ward / average linkage)** | Deterministic; dendrogram supports multiple shadowing layers if ever needed | O(n² log n); no notion of outliers; cuts the tree at an arbitrary threshold | Reject for now — quadratic at federation scale |

**Recommendation: HDBSCAN** with `min_cluster_size = 3` and
`min_samples = 2` (the standard noise-tolerant defaults). Noise points (signatures that don't join a cluster) gracefully fall through to the leaf-only path with Beta(1, 1) — same as today. Re-cluster on a timer (default 6h, env
`SIGNATURE_CLUSTER_INTERVAL_MS`) over all signatures with at least one observation. Run inside `activity-api`; persist results into a new SurrealDB table `signature_cluster_assignment` keyed by `(signature_version, signature)` → `cluster_id`.

JS implementation: `@tutteinstitute/hdbscan` exists but is a Python binding. We use the existing **`hdbscanjs`** package or, if not viable, a pure-TS port of HDBSCAN restricted to ≤30k rows (the substrate's projected ceiling). The clustering pass is a background job; latency is not request-path.

## Shadowing threshold n_min default + tuning

Default `n_min = 5` (env `SIGNATURE_CLUSTER_N_MIN`). Rationale: at $n = 5$ the
Beta posterior's 90% credible interval has half-width $\leq 0.3$ regardless of
prior — wide enough that further cluster-borrowing has diminishing returns,
narrow enough that signatures still shadow heavily during the cold-start regime
that dominates today.

Tuning loop: emit `cluster_shadow_decision` impulses on every selector call,
recording `(signature, cluster_id, n_signature, used_scope)`. After 4 weeks of
canary traffic, fit a logistic curve of `replay-success vs n_min` on held-out
traces. Adopt the $n_{\min}$ that maximizes replay-success; cap at $n_{\min}
\leq 10$ to keep the cluster posterior in play during federation cold-start.

This mirrors `concept_7mzv7SQN_7JB` discipline: the threshold is a single
scalar knob on an existing axis, not a new tier of policy.

## Similarity threshold for clustering (mitigation against posterior contamination)

The principal risk is **behavioral cluster mismatch**: two signatures that look
similar in MiniLM space but have systematically different success rates pollute
the cluster posterior. HDBSCAN's `min_cluster_size` and `cluster_selection_epsilon` knobs control this. Use:

- `min_cluster_size = 3` (signatures with <3 neighbors stay noise)
- `cluster_selection_epsilon = 0.15` on cosine-distance (≈ 0.85 cosine similarity floor — high enough that MiniLM-near pairs share semantic shape)

Plus an **online drift check**: per cluster, compute the per-signature
empirical success rate, $\hat{p}_s$. If $\max_s \hat{p}_s - \min_s \hat{p}_s > 0.4$ for signatures with $n_s \geq 5$ inside the cluster, mark the cluster
`contaminated = true` and the selector ignores the cluster posterior for that
cluster (treats all members as noise). The contaminated flag persists until
the next re-cluster pass corrects it.

## Acceptance criteria

1. **Cluster-level rows accumulate $K\times$ faster than leaf rows.** Measured
   by SurrealDB query: for each cluster with $K \geq 3$ member signatures, the
   ratio
   `(α_C + β_C - 2) / mean_over_members(α_s + β_s - 2) ≥ 0.7 · K`
   over a 2-week window post-deploy.
2. **Behavioral-continuation replay-success on held-out signatures does not
   degrade.** Take a held-out 10% of signatures (excluded from the clustering
   pass), run a replay over the past 2 weeks of traces, measure
   `success_rate_with_cluster_shadow` vs `success_rate_with_leaf_only_baseline`.
   Threshold: cluster-shadow ≥ baseline − 0.02 (no more than 2 percentage
   points worse). If it degrades further, clustering granularity is too coarse
   — auto-bump `min_cluster_size` to 5 and re-cluster.
3. **No new failure_mode types introduced.** Failure-mode harness baseline at
   `validation/failure-modes/` shows zero new modes after 3 cycles post-deploy
   (substrate self-detection principle, `feedback_substrate_self_detection.md`).
4. **Discipline check.** `concept_search shape=hierarchical_signature_clustering_via_dense_embedding` returns concept_skw2SmuLHZlN with relevance trending upward. No new concepts of shape `*_tier` or `*_scope` are minted by this work.
5. **Cluster-posterior write path is non-blocking.** If the cluster-id lookup
   fails (e.g., signature missing from `signature_cluster_assignment`), the
   update falls back to leaf-only — verified by integration test
   `posterior-update-cluster-fallback.test.ts`.

## Out-of-scope

- **Online streaming clustering.** HDBSCAN re-runs on a 6h timer.
  Streaming-incremental variants exist (e.g., DenStream) but the periodic
  batch is good enough at <30k signatures.
- **Cross-template cluster sharing.** Cluster ids are per-`(signature_version)`
  but the cluster posterior is still keyed by `template_id`. We do not pool
  across templates (that's `concept_embedding_conditioned_thompson_posterior`,
  `concept_vugylIHzIMvk`, a separate mechanism).
- **Federation-wide cluster sync.** Each substrate clusters its own signatures;
  cross-substrate cluster identity is a federation-layer concern
  (`SUBSTRATE_AS_MDP.md §27.S.6`).
- **HNSW index on signature embeddings.** O(n) cosine scan is fine at <30k
  rows (cf. activity-api's identical decision in 2026-05-18 F-V58 finding).
- **Selector-side cluster ablation studies.** This proposal ships the
  mechanism. Comparative measurement vs Mechanism 1
  (`embedding_conditioned_thompson_posterior`) lives in a follow-on.

## References

- Concept anchor: `concept_skw2SmuLHZlN` (`hierarchical_signature_clustering_via_dense_embedding`)
- Parent: `concept_TbN0eSf7U_hM` (`learning_rate_improvement_mechanisms`)
- Adjacent: `concept_AIh9mrDEZcmJ` (`computed_thompson_scores` — names the
  existing scope-ordering axis); `concept_EaAYU3p6LsxT` (`thompson_posterior`);
  `concept_vugylIHzIMvk` (`embedding_conditioned_thompson_posterior` —
  alternative parametric approach, complementary not competitor); `concept_YdzaAAQGx4xC` (`picker_static_prior_vs_learned_posterior_bug` — symptom this mechanism reduces)
- Discipline: `concept_7mzv7SQN_7JB`
- Architecture: `docs/architecture/SUBSTRATE_AS_MDP.md` §4.2 (scope ordering as
  partial pooling — the pattern this proposal mirrors), §4.5 (orthogonality is
  the moat — why this stays on an existing axis), `IMPULSE_ACTIVITY_FOUNDATION.md`,
  `LITERATURE_COMPARISON.md`
- Sibling proposals: `2026-06-04-learning-rate-1-embedding-conditioned-posterior` (parametric alternative), `2026-06-04-learning-rate-2-concept-conditioned-prior` (cold-start prior via concept-db)
