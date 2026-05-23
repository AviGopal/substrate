# Tasks: LLM Resolver Model Multi-Armed Bandit

## Phase 1 — Provider config shape

- [ ] 1.1 New shape `llmProviderConfig` (read). Body
  `{ providers: [{ name, models: [{ id, cost_per_input_token, cost_per_output_token, max_context_tokens, capabilities: [...] }] }] }`.
- [ ] 1.2 `llm-resolver-vessel` consumes this on startup; refreshes
  every 5min via the standard impulse-resolve path.
- [ ] 1.3 Bootstrap: provider config seeded via
  `bootstrap-seeder.service` from an operator-authored
  `scripts/substrate/providers.json` (the only remaining operator
  config; flagged for closure-audit review).
- [ ] 1.4 Substrate can amend provider config via `propose-spec`
  flow per `2026-05-23-substrate-closure-properties` §27.3.j.6;
  amendments require operator approval per §27.3.c.

## Phase 2 — Sub-resolver advertisement

- [ ] 2.1 `llm-resolver-vessel` advertises per-model variants of
  each LLM shape. For each `(shape, model)` registered in
  `llmProviderConfig`, the vessel publishes
  `<shape>@<model>` as a separate advertised resolver.
- [ ] 2.2 Discovery-vessel resolves `<shape>@<model>` queries
  directly to the right sub-resolver.
- [ ] 2.3 Shape-level entry remains: a query for `llmText` (no `@`)
  routes through the MAB selector.

## Phase 3 — Per-model posteriors

- [ ] 3.1 Extend `variant_performance_metrics` schema with
  `model_name` field. Migration adds with default null for
  non-LLM rows.
- [ ] 3.2 `applyOutcomeToPosteriors` extended: when the resolved
  pointer was an LLM resolver, write α/β to the
  `(resolver, model_name, problem_class)` row in addition to
  the existing `(resolver, problem_class)` row.
- [ ] 3.3 Cost-weighted-posteriors extension: per-model
  cost_mean / cost_variance / cost_observations_count populated.

## Phase 4 — MAB selector

- [ ] 4.1 New resolver `model-mab-selector`. Given a problem class
  and a target LLM shape, samples from per-model posteriors using
  the active policy (default Thompson). Returns the selected
  model. The selection is recorded in trace metadata as
  `selected_via_mab: true, mab_policy: "thompson_sampling"`.
- [ ] 4.2 Cold-start: when a `(resolver, model, problem_class)`
  triple has zero observations, sampling uses Beta(1,1) prior.
- [ ] 4.3 Tie-breaking: when expected values are within ε=0.01,
  the cheaper model wins.

## Phase 5 — Policy selector

- [ ] 5.1 Three policy resolvers: `thompson_sampling`, `ucb1`,
  `epsilon_greedy`.
- [ ] 5.2 `mab-policy-selector` Thompson-samples among policies
  per problem class. Default: thompson_sampling.
- [ ] 5.3 Policy α/β updates derived from end-of-window
  α-per-dollar metric (same machinery as
  cost-weighted-posteriors policy selector).

## Phase 6 — Per-resolver caps

- [ ] 6.1 Activity template schema gains optional
  `llm_model_constraints: { forbidden_models?: [], required_capabilities?: [] }`.
- [ ] 6.2 MAB selector consults the active activity's constraints
  before sampling. Forbidden models are excluded from the sampling
  pool. Required capabilities filter the pool (e.g., only models
  with `tool_use` capability).
- [ ] 6.3 Initial caps:
  - `audit-security` (from closure spec): `forbidden_models: ["haiku-*"]`.
  - `foundation-compliance` validator: `required_capabilities: ["long_context"]`.
- [ ] 6.4 Cap violations attempted (a Thompson sample selects a
  forbidden model) raise a `safety_breach` failure mode and the
  selector re-samples without that model.

## Phase 7 — Bootstrap via forge

- [ ] 7.1 Define a curated benchmark of 50 prompts spanning
  problem classes. Stored in
  `validation/benchmarks/model-mab-bootstrap.json`.
- [ ] 7.2 Substrate-forge dispatches: one fork per model,
  each running the full benchmark. 24h budget.
- [ ] 7.3 Outcomes feed the initial
  `(resolver, model, problem_class)` posteriors.
- [ ] 7.4 Post-bootstrap, MAB selector runs in the canonical
  substrate; benchmark may be re-run periodically to refresh
  cold posteriors.

## Phase 8 — Reporting

- [ ] 8.1 New `modelMabReport` impulse weekly. Body
  `{ per_resolver_model_distribution, cost_per_alpha_by_model,
  promotion_recommendations: [...] }`.
- [ ] 8.2 Workbench `TemplatesPage` shows per-activity model
  distribution as a stacked bar.
- [ ] 8.3 Phase 19 harness adds **model-distribution-entropy** as
  a diagnostic: high entropy = substrate still exploring; low
  entropy = substrate has converged.

## Phase 9 — IAL integration

- [ ] 9.1 Amend IAL §27.3.g with §27.3.g.9.
- [ ] 9.2 Update CLAUDE.md "MiniBob Configuration Priority"
  section (which today hardcodes default model) to reflect the
  MAB selection.
- [ ] 9.3 Defaults section in CLAUDE.md notes that
  `claude-sonnet-4-20250514` is the cold-start tier-2 default,
  not the running default.

## Phase 10 — Canary validation

- [ ] 10.1 Pre-deployment baseline: capture average LLM cost per
  α earned over a 7-day window. Per-model usage distribution.
- [ ] 10.2 Deploy MAB. Compare 4-week post-deployment metrics.
- [ ] 10.3 Expected: ≥30% reduction in average LLM cost per α
  on routine resolvers; no regression on novel resolvers; per-
  activity model distribution shows convergence patterns.
