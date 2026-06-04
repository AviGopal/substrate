# Tier-Restricted Bandit: Skip Thompson on Deterministic Cells

**Status:** draft
**Author:** substrate dev-loop
**Date:** 2026-06-04
**Substrate anchor concepts:**
- `concept_SDerP4GcuhGm` — tier_restricted_bandit_skipping_deterministic (this change's primary anchor)
- `concept_TbN0eSf7U_hM` — parent / learning-rate research family
- `concept_RZGwUvuKDHSl` — metabob-activity-api as Thompson-Sampling learner
- `concept_y4wjxfQAMSBU` — "resolvers live where data lives" (the principle the
  tier classification rests on: deterministic resolvers' P(s'|s,a) is a delta
  because the resolver owns its data and the transition is a function call)

**Canonical foundation:** `docs/SUBSTRATE_AS_MDP.md`,
`docs/LITERATURE_COMPARISON.md`, `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`.
Four primitives (impulse / activity / vessel / trace), three scopes (template /
variant / signature), no new tiers. `concept_7mzv7SQN_7JB` gates the
no-new-primitive discipline; this change adds zero.

---

## Why

The substrate models the development loop as a factored Bayesian Q-learning
problem on an open-world MDP. The factor that matters here is the cell
`(template, task)`: each task in a template is one cell whose outcome the
Thompson Sampling posterior tracks via `(thompson_alpha, thompson_beta)` on
`variant_performance_metrics`.

The substrate already records `resolver_tier ∈ {deterministic, pattern, llm}`
per task:
- `repos/metabob-activity-api/src/middleware/runtime-tracing.ts:34`
- `repos/metabob-activity-api/src/websocket/types.ts:122,166`
- `repos/metabob-activity-api/src/models/schemas.ts:503`
- `repos/metabob-activity-api/src/db/paradigm.ts:181`

For **deterministic-tier** cells the transition kernel is degenerate:
- `P(s' | s, a) = δ(s' = f(s, a))` — `bash`, `file_read`, `iteration`,
  `impulse-resolve`, `validation` etc. are pure functions modulo the I/O
  resource they pin against. No stochasticity in the state transition.
- `R(s, a)` is deterministic at the resolver level (no LLM sampling, no
  pattern-matching ambiguity). Outcome variance is dominated by upstream
  cells, not by this cell.

A Beta posterior on such a cell does not represent uncertainty about that
cell — it represents propagated uncertainty from elsewhere. Spending sample
budget to maintain it is wasted exploration.

### Rate gain (back-of-envelope)

Let `f_det` be the fraction of cells that are deterministic-tier across the
template registry. The audit-trace shape (`template-audit.ts:10`) flags
"all-LLM task graphs" as a deficiency, and observed traces show most
production templates mix `bash`/`file_read`/`iteration`/`validation` (all
deterministic) with one or two `llm-prompt` tasks. Assume `f_det ≈ 0.6`.

If 60% of cells skip Thompson and their sample budget is redistributed to the
remaining 40% stochastic cells, the per-stochastic-cell sample rate rises by
`1 / (1 - f_det) = 2.5×`. Under standard Beta posterior shrinkage
(variance ~ 1/n), credible-interval width shrinks as `1/√n`. So the
**effective learning rate gain ≈ √2.5 ≈ 1.6×** on the cells that actually
have signal to learn from.

This is conservative: it ignores that deterministic-cell α/β writes also
contend on the same `variant_performance_metrics` row as their template's
stochastic cells, so the actual write-throughput gain is larger.

---

## What this change does NOT do

- It does not add a new tier. The three tiers stay
  (`deterministic` / `pattern` / `llm`).
- It does not change the resolver dispatch path. Deterministic tasks still
  run; only their posterior accounting is skipped.
- It does not affect cells whose `resolver_tier` is unknown / missing. Those
  default to the stochastic path (conservative).
- It does not touch the `concept_SDerP4GcuhGm` parent concept's other
  children (cost-weighted posteriors, signature keying, etc.).
- It does not introduce versioning. The classifier reads tiers from existing
  fields; old templates without `resolver_tier` on their tasks fall through
  to the existing Thompson path.

---

## Existing surface

### Where `resolver_tier` lives

| Site | File:line | Notes |
|---|---|---|
| Trace storage (per-task) | `src/db/paradigm.ts:181,332` | Optional string on stored execution trace tasks. |
| Schema (per-task) | `src/models/schemas.ts:503,523` | `z.string().optional()` on `ExecutedTaskSchema`. |
| Middleware classification | `src/middleware/runtime-tracing.ts:34,248,258,374` | Source of truth: `'deterministic' \| 'pattern' \| 'llm'`. |
| WebSocket broadcast | `src/websocket/types.ts:122,166` | Emitted on `task.completed` / `impulse.resolved`. |
| Template task | `src/models/schemas.ts:79-112` | `TemplateTaskSchema` has `resolver: string` but **no** `resolver_tier` field — tier must be derived from `resolver` at classification time. |

### Where Thompson selection happens

`src/routes/activities.ts` `/v2/activities/recommend` handler. The hot loop:
- `line 6049-6286` — `validTemplates.map(template => …)` computes
  `alpha`, `betaVal`, applies heuristic boosts, blends context-bucketed
  posterior (line 6160-6175), then `betaSample(alphaBlended, betaBlended)`
  at `line 6191`.

### Where posterior writes happen

`src/lib/posterior-update.ts` — `applyOutcomeToPosteriors(trace, db, orgId)`.
- `line 473-503` — atomic UPDATE on `variant_performance_metrics`.
- `line 506-578` — v1 conditional `context_thompson_scores` write.
- `line 603-619` — fire-and-forget `propagateCreditAlongChain` on
  composition chain ancestors.

Call sites (per the module's own header comment): `execution-traces.ts`,
`activities.ts (×2)`, `goal-paths.ts`.

---

## The change

Add a tiny classifier `classifyTemplateTiers(template)` that maps the
template's `tasks[].resolver` strings to a tier set, using the same
built-in-resolver inventory already declared at
`src/routes/activities.ts:3708-3723`:

```
deterministic: bash, file_read, iteration, impulse-resolve, validation,
               impulse_pool_selection, producer_selection, impulse_preparation,
               wire_discovery_registration, wire_auth_blueprint,
               learning_signal_writer, verify_three_invariants, compose,
               activity_recommendation, impulse_cooccurrence
llm:           llm, llm-prompt
pattern:       (any other registered resolver — conservative fallback)
unknown:       no resolver field (LLM-prompt-only task) → treat as llm
```

`classifyTemplateTiers` returns `'all_deterministic' | 'mixed' | 'all_stochastic'`.

### Selection-side branch

In `activities.ts` after computing `(alphaBlended, betaBlended)`
(line 6164-6175), branch on the classifier:

```ts
const tierClass = classifyTemplateTiers(template);
let sample: number;
let sampleSource: 'app_fallback' | 'tier_uniform';
if (tierClass === 'all_deterministic') {
  // Skip Thompson — uniform priority. Use 1.0 so the candidate stays in
  // the candidate set but doesn't compete for the exploration slot.
  sample = 1.0;
  sampleSource = 'tier_uniform';
} else {
  sample = betaSample(alphaBlended, betaBlended);
  sampleSource = 'app_fallback';
}
```

Stamp `tierClass` and `sampleSource` into `selection_metadata` so traces
can audit which path was taken.

### Write-side branch

In `posterior-update.ts` `applyOutcomeToPosteriors`, classify by inspecting
`trace.tasks[*].resolver_tier`. When every task is `deterministic`, skip
the `variant_performance_metrics` UPDATE and the v1 conditional write
(emit the metric event and return a summary with `alpha_delta = 0`,
`beta_delta = 0`, and a new `skipped_reason: 'all_deterministic'`).
Chain-credit propagation still fires (ancestors may be stochastic).

`TraceForPosterior` already exposes `tasks?: Array<{...}>` at line 43-46; we
extend it with the optional `resolver_tier` field, no breaking change.

---

## Acceptance criteria

1. **Patch applies cleanly** to the current `dev` HEAD of
   `repos/metabob-activity-api`.
2. **Existing tests pass.** `bun test` in `repos/metabob-activity-api`.
3. **New tests** added in `src/lib/posterior-update.test.ts` and
   `src/services/tier-classifier.test.ts`:
   - All-deterministic template → `skipped_reason: 'all_deterministic'`,
     no DB UPDATE issued (mock DB sees zero queries on
     `variant_performance_metrics`).
   - Mixed template → DB UPDATE issued as before.
   - All-LLM template → DB UPDATE issued as before.
   - Unknown resolver → treated as stochastic (conservative).
   - Template with no `tasks` field → treated as stochastic.
4. **Observable in canary:** within one weekly stratified-harness window,
   `selection_metadata.sample_source = 'tier_uniform'` appears in
   recommendation traces for at least one all-deterministic template.
5. **Learning-rate evidence:** stratified-harness MRR run two weeks
   post-deploy shows non-decreasing MRR with reduced posterior-write rate
   on `variant_performance_metrics` (observable via SurrealDB row-update
   counters or substrate trace counts).

---

## Out of scope

- Per-template tier classification cache. (Pure-function classifier is
  cheap; cache only if profiling shows it on the hot path.)
- Re-classifying historical traces. The write-side branch handles new
  traces; old `variant_performance_metrics` rows are left as-is.
- Promoting `resolver_tier` to a first-class field on `TemplateTaskSchema`.
  (Tier is derivable from `resolver`; promoting it would be redundant.)
- Touching `propagateCreditAlongChain`. Ancestor decay applies whether or
  not the leaf was deterministic; the cascading-failure heuristic is
  orthogonal to tier.
- HNSW / dense-search interactions. Tier classification is independent of
  the embedding path.
- The DB-side `fn::beta_sample` promotion (Phase 10 P5A 10.15) — that
  migration is unrelated; this change leaves its sample_source label
  alone except for the new `'tier_uniform'` variant.

---

## Risk + rollback

- **Risk:** a template mis-classified as all-deterministic loses its
  Thompson signal until the classifier is fixed. Mitigation: the
  classifier defaults unknown resolvers to stochastic, and the test
  suite covers every built-in resolver listed at `activities.ts:3708`.
- **Rollback:** revert the patch. No schema migration; no data is
  destroyed; the only state change is that some `variant_performance_metrics`
  rows received fewer writes during the deploy window. Re-enabling the
  full Thompson path on revert recovers normal accounting.
