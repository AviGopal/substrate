# Embedding-conditioned Thompson posterior (learning-rate mechanism #1)

## Substrate concept anchors

- **Primary mechanism — `concept_vugylIHzIMvk`** (`embedding_conditioned_thompson_posterior`):
  > Replace independent Beta(α, β) per (signature, template) cell with parametric
  > model α = f_α(e; θ), β = f_β(e; θ) over dense embeddings. Reduces sample
  > complexity from O(|C|/ε²) to O(d/ε²). HyperAgent-validated. Single biggest
  > available rate win.

- **Umbrella initiative — `concept_TbN0eSf7U_hM`** (`learning_rate_improvement_mechanisms`):
  parent grouping concept for the rate-improvement family. This proposal is
  mechanism #1 under that umbrella.

- **Vocabulary gate — `concept_7mzv7SQN_7JB`** (user_preference, "don't invent
  new substrate tiers"): every claim in this proposal restates under the four
  substrate primitives (impulse, activity, signature, Thompson-per-arm). No new
  tier, category, or storage class is introduced — `f_α`/`f_β` is a parametric
  *prior over the existing per-arm Beta posterior*, not a new posterior type.

- **Adjacent / consequent concepts** (already in concept-db, cited so this
  proposal links rather than re-mints):
  - `concept_AIh9mrDEZcmJ` (`computed_thompson_scores`) — α/β are *computed*
    from the `execution` table aggregate, not stored on the template. This
    proposal does not change that contract; it adds a separate *prior*
    component that biases the sample before the empirical update applies.
  - `concept_YdzaAAQGx4xC` (`picker_static_prior_vs_learned_posterior_bug`) —
    documents that template records carry both a static `thompson_alpha=1`
    prior at top level and a learned posterior in `metrics.thompson_alpha`.
    The embedding-conditioned prior replaces the static `1` with a value
    conditioned on the cell's embedding.
  - `concept_uTVZPoaxMmo2` (`concept_conditioned_thompson_prior`) — the
    *cheap-to-ship* sibling mechanism: empirical-Bayes warm-start from
    concept-db neighbors at cold-cell time. This proposal subsumes it as a
    special case (k-NN regression is one of the three implementation options
    below; concept_uTVZPoaxMmo2 is mechanism #1.a if shipped alone).
  - `concept_skw2SmuLHZlN` (`hierarchical_signature_clustering_via_dense_embedding`)
    — clusters signatures via dense embeddings and maintains posteriors at
    cluster + signature with shadowing. Orthogonal: clustering reuses
    embeddings to *bucket signatures*, this proposal reuses embeddings to
    *parameterize the prior across signatures*. Both can co-exist; clustering
    operates at the row level, the parametric prior operates at the
    sample-call level.
  - `concept_X2xSovM76TpT` (`class_b_shape_gap_thompson_posterior`) — confirms
    the α/β/sample_count surface already exists in
    `variant_performance_metrics` and the `thompson_posterior` impulse shape.

## The math, in substrate vocabulary

The substrate's selection step is, factored over arms `a ∈ A(s)` keyed by
`(signature s, template t)`:

```
a* = argmax_a  θ_a       where  θ_a ~ Beta(α_a, β_a)
```

`α_a`, `β_a` today are derived per-cell:

```
α_a = count(success = true | a) + 1
β_a = count(success = false | a) + 1
```

(See `repos/metabob-activity-api/src/routes/impulses.ts:1383-1387` —
`thompson_posterior` resolver.) Every new `(s, t)` cell starts at Beta(1, 1),
**independent of every other cell**. Sample complexity to drive each cell's
posterior variance below ε² is O(1/ε²). Across the whole arm space:
**O(|C|/ε²)** where `|C|` = number of distinct `(s, t)` cells.

The replacement is parametric:

```
α_a = f_α(e_a; θ),    β_a = f_β(e_a; θ)
```

where `e_a` is the dense embedding of the arm's context — concretely, the
MiniLM 384-dim embedding concept-db already maintains for the signature,
template, and (optionally) goal text. `θ` is shared across all arms. Each
trace updates `θ` once. Cells with no direct samples still get a *non-trivial*
prior from `θ` via their embedding `e_a`. Sample complexity collapses to
**O(d/ε²)** where `d` is the effective dimension of `θ` — for the
recommended ridge variant, `d = 384`.

This is the HyperAgent result (`arXiv:2402.10228`): a neural-function-
approximation Thompson sampler attains `Õ(√T)` regret in deep RL, vs.
tabular `Õ(|S|·|A|·√T)` for independent-arm sampling.

Restated under the substrate primitives: the **arm** is still
`(signature, template)`. The **per-arm Beta posterior** still exists. What
changes is the *prior* — instead of every cell starting at Beta(1, 1) and
moving only on its own samples, every cell starts at
Beta(f_α(e), f_β(e)) and the posterior remains the standard
Beta-conjugate update from there. **No new tier. No new shape. No new
storage class.** A parametric prior is a parameter substitution inside the
existing Thompson-per-arm primitive.

## Existing substrate surface

### Where Thompson posteriors live in activity-api

- **Read path**: `repos/metabob-activity-api/src/routes/impulses.ts:1319-1500`
  — the `thompson_posterior` impulse resolver. Aggregates over the
  `execution` table per-variant (filterable by `shape_signature`,
  `context_bucket`, `signature_version`). Returns
  `{ alpha, beta, sample_count, success_count, failure_count }`.

- **Storage table 1 — `execution`**: the canonical aggregate source. α/β are
  computed on-the-fly via `count(success = true) + 1` /
  `count(success = false) + 1` (impulses.ts:1383-1387).

- **Storage table 2 — `variant_performance_metrics`**: precomputed
  per-variant summary including `thompson_alpha`, `thompson_beta`,
  `total_executions`. Populated by Thompson update path
  (`src/services/thompson-sampling.ts:118` —
  `computeThompsonSamplingUpdates`). Migration 129 fixes PERMISSIONS on
  this table.

- **Storage table 3 — `context_thompson_scores`**: stratified posteriors
  keyed by `(org_id, template_id, signature_version, context_bucket)`.
  Migration 130 added `signature_version` (0 = legacy context-bucket,
  1 = shape+provenance hash). Read at impulses.ts:3468.

- **Update path**: `repos/metabob-activity-api/src/routes/execution-traces.ts:2203`
  — `computeThompsonSamplingUpdates(trace.success, shapeMatchMetadata.shapeMatchScore)`
  fires on each trace ingest.

- **Static prior in template records**: `models/schemas.ts:674-675` —
  `thompson_alpha: z.number().default(1.0)`,
  `thompson_beta: z.number().default(1.0)`. This is the slot the new
  parametric prior writes into (per the picker bug, this slot is read by
  some callers and is currently always 1).

### Where dense embeddings live in concept-db

- **Service**: `repos/concept-db/src/services/embedding.ts` —
  `LocalEmbeddingService`. ONNX `all-MiniLM-L6-v2`, INT8, 384-dim,
  L2-normalised Float32Array output. Backfill loop in
  `repos/concept-db/src/index.ts:214-265` populates
  `content_embedding` and `summary_embedding` on every concept row.

- **Search**: `repos/concept-db/src/resolvers/concept.ts:559-620` — cosine
  search over `content_embedding` / `summary_embedding`. O(n) scan
  (HNSW deferred; Phase 18 documented in CLAUDE.md).

- **REST surface**: `GET /concepts/search?embeddings=1` returns vectors;
  default-off because each vector is ~8KB.

The embeddings are *already paid for*. The activity-api and concept-db
both run inside the substrate-live container; cross-vessel reads are a
single HTTP hop.

## Three implementation options

### Option A — ridge regression (recommended)

`f_α(e) = softplus(w_α · e + b_α)`, `f_β(e) = softplus(w_β · e + b_β)`.
Two `384`-dim weight vectors + two biases. Update via online ridge regression
on each trace: `(e_a, success)` → squared-loss update on `(w_α, w_β)`.

- **Pros**: linear, closed-form online update, single matrix per arm-family,
  trivially auditable, easy to roll back (set `θ = 0` → recovers Beta(1, 1)).
- **Cons**: linear-in-e capacity ceiling. Won't capture interactions between
  embedding dimensions.
- **Cost**: ~3 KB of parameters per template family. Update is one dot
  product + one weight delta per trace. Inference is one dot product per
  arm at sample time.

### Option B — small MLP (HyperAgent-faithful)

Two hidden layers, 64 units, ReLU. `θ ≈ 25 K` parameters. Trained online via
SGD with replay buffer over the last N traces.

- **Pros**: matches HyperAgent literature exactly; captures interactions.
- **Cons**: needs replay buffer, optimizer state, periodic re-fit; harder to
  audit; introduces a new failure mode (gradient blow-up, overfitting under
  low trace volume).
- **Cost**: ~100 KB parameters. ~1 ms inference per arm.

### Option C — Gaussian-Process posterior on (α, β)

Place a GP prior on `log α(e)` and `log β(e)` with an RBF kernel over the
384-dim embeddings; condition on observed `(e, success)` pairs.

- **Pros**: principled uncertainty; the prior covariance directly gives the
  width of the exploration bonus.
- **Cons**: O(N³) inversion at the trace-count scale; needs sparse-GP
  approximation; numerical fragility.
- **Cost**: prohibitive without sparse approximation; for now, parked as
  *future* once trace count plateaus.

**Recommendation: Option A.** It is the smallest change consistent with the
mechanism, audits cleanly under the four primitives, and delivers the
O(d/ε²) rate immediately. Option B is a follow-up once Option A has live
priors and we have evidence the linear ceiling is binding.

## Acceptance criteria (substrate-internal observables)

These are measured against the substrate-live local container, not against
canary, per CLAUDE.md substrate-only deployment direction.

1. **Per-cell variance trajectory.** Pick 20 `(signature, template)` cells
   with current sample_count ∈ [0, 5]. Before/after: posterior variance
   `αβ / ((α+β)² (α+β+1))`. Acceptance: median variance at sample_count=0
   drops by ≥ 30% relative to Beta(1, 1) baseline (0.0833).

2. **MRR delta on the existing harness.** Re-run
   `validation/scripts/stratified-harness.ts` (per CLAUDE.md Phase 18
   harness). Current baselines: post-F-V58-fix MRR = 0.2361. Acceptance:
   MRR ≥ 0.26 (≥ +0.02 absolute) on the same corpus; no regression on
   `improvise_health.success_rate` (currently 1.0).

3. **Cold-cell coverage.** Fraction of `(s, t)` cells with non-trivial
   prior (`α + β > 2.0001`). Today: 0% by construction. Acceptance: ≥ 80%
   of cells in the validation corpus have a parametric prior populated
   from `θ`.

4. **Regret on the failure-mode harness.** `failure-mode-harness.ts`
   reports cumulative-regret over rotating scenarios. Acceptance:
   cumulative-regret slope after 200 traces is statistically below the
   per-cell baseline (paired test, p < 0.05) measured over three
   harness windows.

5. **No regression on the four primitives.** Shape-dispatch check
   (`bun run lint`) passes — confirms no new shape, no new resolver name,
   no new tier. Concept count for `source_type=impulse_activity_pattern`
   under the umbrella `concept_TbN0eSf7U_hM` increases by 1 (this proposal
   itself as a percolation memo) and not more.

## Out of scope

- **Not changing the per-arm posterior aggregate.** `execution`-table
  `count(success = true) + 1` remains the empirical posterior. The
  parametric piece is the *prior* slot only.
- **Not adding a new impulse shape.** `thompson_posterior` covers the
  read path; the parametric prior is invoked inside the existing resolver,
  not as a sibling shape.
- **Not adding new tables.** `θ` weights live in a single new field on
  the existing `activity` (or `activity_template`) row, or in a per-
  family row in `variant_performance_metrics`. Decided in DEV phase.
- **Not changing concept-db.** Embeddings are read via the existing
  `/concepts/search?embeddings=1` path or by direct SurrealDB query
  inside the substrate-live container.
- **Not introducing federated training across substrates.** `θ` is
  per-substrate, same scope rules as everything else (org / account /
  global with partial pooling).
- **Not implementing Option B or C.** Tracked as follow-ups.
- **Not deprecating** `concept_uTVZPoaxMmo2` (concept-conditioned prior).
  If Option A ships first, the k-NN warm-start it describes becomes a
  special case of `f_α` initialisation rather than a separate mechanism.
- **Not modifying `state_pattern_learner` clustering** — orthogonal
  signature-bucketing concern (`concept_skw2SmuLHZlN`).

## Why this is the right next change

Per `docs/architecture/SUBSTRATE_AS_MDP.md` and `LITERATURE_COMPARISON.md`,
the substrate is one well-known mechanism short of the literature frontier:
neural-function-approximation Thompson sampling. The embeddings are paid
for. The posterior read path is one resolver case. The update path is
one service call. The risk of regression is bounded by the rollback —
set `θ = 0` and the system returns to the Beta(1, 1) prior it has today.

This is mechanism #1 of the rate-improvement umbrella because every
*subsequent* rate mechanism (signature clustering, concept-conditioned
warm-start, hierarchical pooling) presupposes that the prior is allowed
to be conditioned on something. Shipping #1 unblocks #2 through #N.
