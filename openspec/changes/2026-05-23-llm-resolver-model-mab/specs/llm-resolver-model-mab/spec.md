# Capability: llm-resolver-model-mab

## Definition

`llm-resolver-vessel` advertises per-model sub-resolvers for each LLM
shape it owns. A shape-level entry (e.g., `llmText`) routes through a
`model-mab-selector` resolver that Thompson-samples among per-model
sub-resolvers (`llmText@haiku`, `llmText@sonnet`, `llmText@opus`, plus
equivalent sub-resolvers for other configured providers). Posteriors
are tracked per `(resolver, model, problem_class)` triple. The MAB
policy is itself selectable (Thompson / UCB1 / ε-greedy) but bounded
to one level of recursion.

## Shapes

- `llmProviderConfig` (read) — body
  `{ providers: [{ name, models: [{ id, cost_per_input_token, cost_per_output_token, max_context_tokens, capabilities: [...] }] }] }`.
  Seeded at bootstrap; substrate-amendable via §27.3.c-respecting
  proposals.
- `<shape>@<model>` (read or write per the base shape) — per-model
  sub-resolvers. Examples: `llmText@haiku`, `llmStructured@opus`,
  `llmToolCall@gpt-5`.
- `modelMabReport` (read) — weekly emission. Body
  `{ per_resolver_model_distribution: {...},
  cost_per_alpha_by_model: {...},
  promotion_recommendations: [...] }`.

## Schema additions

`variant_performance_metrics` extended with:

| Field | Type | Default | Notes |
|---|---|---|---|
| `model_name` (new) | string \| null | null | populated for LLM resolver rows |

A single LLM activity execution writes:
- The base `(resolver, problem_class)` row's α/β (existing).
- The new `(resolver, model_name, problem_class)` row's α/β.

Both rows update consistently; failure-mode and confidence weighting
apply identically.

## Selector

`model-mab-selector` resolver:

1. Consults the active activity's `llm_model_constraints` (forbidden
   models, required capabilities).
2. Filters the model pool to those satisfying constraints.
3. Samples from the filtered pool using the active policy (per
   `mab-policy-selector`).
4. Returns the selected model + `selected_via_mab` metadata.
5. Cold-start `(resolver, model, problem_class)` triples sampled
   uniformly from Beta(1,1).

## Policy selector

`mab-policy-selector` Thompson-samples among:

- `thompson_sampling` (default; existing Beta sampling rule)
- `ucb1` (deterministic UCB with √(2 ln N / n_arm) confidence bound)
- `epsilon_greedy` (ε=0.1 random exploration, otherwise argmax expected α)

Policy α/β updated from end-of-window α-per-dollar metric.

## Per-resolver caps

Activities may declare `llm_model_constraints` to restrict the MAB:

```json
{
  "llm_model_constraints": {
    "forbidden_models": ["haiku-*"],
    "required_capabilities": ["tool_use", "long_context"]
  }
}
```

The MAB respects these strictly. A sample selecting a forbidden model
raises `safety_breach.breach_type: "constraint_violation"` and re-samples.

## Self-application invariants

1. **No new primitive** — model selection is resolver selection. The
   existing Thompson machinery handles it.
2. **Closure-bound** — `closure-audit --without=operator-shell` covers
   model MAB operations. Provider config bootstrap is the one
   remaining operator dependency; flagged for substrate-amendment via
   `propose-spec`.
3. **Confidence-weighted** — per-trace confidence weight applies to
   per-model posterior updates.
4. **Cost-weighted** — model MAB is the canonical use case for cost-
   weighted Thompson. Sub-resolver selection inherently optimizes
   α/cost.
5. **Recursive bandit, bounded** — policy selection (Thompson / UCB1 /
   ε-greedy) is bounded to one level. Past that, fixed prior.
6. **Provider-agnostic** — adding Gemini, Llama, or local-model
   sub-resolvers is a `llmProviderConfig` amendment. No code change.

## Bootstrap via forge

Initial posteriors are established by substrate-forge:

1. Read curated benchmark of 50 prompts from
   `validation/benchmarks/model-mab-bootstrap.json`.
2. Spawn one fork per registered model.
3. Each fork runs the benchmark; outcomes feed initial posteriors.
4. After 24h budget, forks tear down; posteriors are imported into
   canonical substrate.
5. MAB selector becomes active in canonical substrate.

Bootstrap is itself a substrate-resident activity dispatched via
`substrate-forge-vessel`; no operator intervention.

## Acceptance

1. **Sub-resolvers advertised**: discovery-vessel registry shows
   per-model entries for each LLM shape.
2. **Per-model posteriors populated**: variant_performance_metrics
   rows with `model_name` for ≥80% of LLM activities after 7 days.
3. **Routing observable**: a `POST /v2/impulses/resolve` for `llmText`
   returns the selected model in response metadata.
4. **Cost reduction**: average LLM cost per α earned on routine
   resolvers is ≥30% lower than pre-deployment baseline after 4 weeks.
5. **No quality regression**: Phase 19 MRR within ±2% of baseline.
6. **Cap enforcement**: `audit-security` activity never routes to
   Haiku in 1000-sample observation window.
7. **Policy learning**: after 100 dispatches, MAB policy selector
   has informative posteriors (CI ≤0.4) for at least one problem
   class.
8. **Closure**: `closure-audit --without=operator-shell` zero
   failures for model MAB.

## Status

Post-substrate-explicit-vessels (llm-resolver-vessel must exist).
Post-substrate-forge-vessel (bootstrap mechanism). Coordinated with
cost-weighted-posteriors. Pre-distillation: model MAB's
α-per-dollar-by-model output is a distillation signal — if a cheap
model converges on a problem class, that class becomes a candidate
for further distillation to deterministic.
