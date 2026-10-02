# Proposal: LLM Resolver Model Multi-Armed Bandit

## Why

CLAUDE.md hardcodes `claude-sonnet-4-20250514` as the default model
across LLM-flavoured resolvers. Memory note `feedback_*` confirms this
applies broadly. Under local-substrate cost constraints, every LLM
call's per-token cost matters; Sonnet's cost is ~5× Haiku and ~5×
cheaper than Opus. The hardcoded choice means:

- Routine resolvers (keyword extraction, simple validation,
  one-pass summarization) pay Sonnet rates for work Haiku would
  complete equivalently.
- Novel resolvers (foundation-compliance validation, multi-step
  decomposition) may underperform at Sonnet when Opus would yield
  higher α — but the substrate has no mechanism to detect this.

The principled fix is to advertise sub-resolvers per model
(`llmText@haiku`, `llmText@sonnet`, `llmText@opus`, plus equivalent
sub-resolvers for other providers when configured) and let
Thompson Sampling learn which model suffices for which
`(resolver, problem-class)`. This is a textbook multi-armed bandit
applied to model selection — well-studied, predictable convergence
properties, and structurally identical to the existing template
selection bandit.

The effect compounds under cost-weighted posteriors
(sibling spec): the substrate selects the cheapest model that yields
acceptable α for each resolver-problem pair, freeing budget for novel
exploration.

## Self-application

Model MAB is itself a selection mechanism subject to the same
invariants:

- **Foundation alignment** — sub-resolvers per model are just more
  resolvers. They advertise through discovery; they emit traces; they
  accrue α/β. No new primitive.
- **Closure** — model selection is substrate-resident. The MAB policy
  is not operator-pinned. The substrate's `llm-resolver-vessel` reads
  the policy from its own state, not from an operator config file.
- **Confidence weighting** — model α/β updates respect
  `signal_confidence_weight`. A low-confidence outcome from Haiku
  doesn't dominate Sonnet's posterior.
- **Cost weighting** — model MAB is the canonical use case for cost-
  weighted posteriors. Sub-resolver selection optimizes for α/cost
  per problem class.
- **MAB policy itself is Thompson-managed** — the choice among
  Thompson sampling, UCB1, ε-greedy for model selection is itself a
  bandit, but bounded to one level (matching the cost-weighting
  spec's recursive policy depth limit).
- **Provider-agnostic** — Haiku/Sonnet/Opus are placeholders for any
  registered model. Adding Gemini, Llama, or local-model sub-resolvers
  is a configuration change, not a code change. Each new model
  registers as a sub-resolver and accrues its own posteriors.

## What Changes

1. **Sub-resolver advertisement**: `llm-resolver-vessel` advertises
   per-model variants of each shape it resolves:
   - `llmText@haiku`, `llmText@sonnet`, `llmText@opus`
   - `llmStructured@haiku`, `llmStructured@sonnet`, `llmStructured@opus`
   - `llmToolCall@haiku`, `llmToolCall@sonnet`, `llmToolCall@opus`
   - Plus equivalents for other configured providers
     (`llmText@gpt-5`, `llmText@gpt-5-mini`, etc.)
2. **Shape-level routing**: `llmText` remains advertised as the
   shape-level entry; behind it sits a `model-mab-selector` resolver
   that samples among the registered model sub-resolvers using
   Thompson (or whatever policy the recursive selector chose).
3. **Per-model posteriors**: `variant_performance_metrics` extended
   with a `model_name` field for LLM resolver rows. Each
   `(resolver, model, problem_class)` tuple accrues α/β + cost
   posterior independently.
4. **Bootstrap via substrate-forge**: initial model posteriors are
   established by spawning one fork per model and running 24h of
   curated benchmark prompts; outcomes feed initial posteriors.
   Cold-start is uniform Beta(1,1) across models per problem class.
5. **Provider-config impulse**: a new `llmProviderConfig` shape
   (read-only) advertises the set of registered providers and models.
   `llm-resolver-vessel` consumes this on startup. Operator-authored
   initially (the only operator config remaining); becomes substrate-
   maintained once distillation produces feedback.
6. **MAB policy selector**: bounded recursive Thompson over
   `{thompson_sampling, ucb1, epsilon_greedy}`. Defaults to Thompson;
   substrate may shift policy if data supports.
7. **Per-resolver caps**: certain resolvers are configured with a
   cap on which models they may use (e.g.,
   `audit-security` activity forbids Haiku because security-sensitive
   reasoning benefits from frontier models). Caps configured in the
   resolver's metadata, respected by the MAB.

## Success criteria

1. **Sub-resolvers advertised**: discovery-vessel registry shows
   per-model sub-resolvers for each LLM shape.
2. **Per-model posteriors populated**: `variant_performance_metrics`
   rows with `model_name` populated for activities with ≥10 traces.
3. **Routing observable**: a single `POST /v2/impulses/resolve` with
   `pointer.type = "llmText"` returns the Thompson-selected model in
   the response metadata. Repeated calls across a problem class show
   convergence on the dominant model.
4. **Cost reduction measurable**: after 4 weeks of operation, average
   LLM cost per α earned is ≥30% lower than pre-deployment baseline
   on routine resolvers. (Novel resolvers may not show reduction —
   that's expected.)
5. **No quality regression**: Phase 19 reuse-harness MRR within ±2%
   of pre-deployment.
6. **Cap enforcement**: a `audit-security` activity does NOT route to
   Haiku, regardless of Thompson sampling.
7. **Closure**: `closure-audit --without=operator-shell` zero failures.

## Capabilities

### New Capabilities

- `llm-resolver-model-mab` — per-model sub-resolvers; shape-level
  routing via `model-mab-selector`; per-(resolver, model, problem_class)
  posteriors; Thompson policy selector; provider config impulse; per-
  resolver caps. Spec: `specs/llm-resolver-model-mab/spec.md`.

### Modified Capabilities

- `substrate-explicit-vessels`: `llm-resolver-vessel` (port 8220) gains
  per-model sub-resolver advertisement.
- `cost-weighted-posteriors`: model MAB is the canonical caller; the
  policies selector applies.
- IAL Phase 27.3.g gains §27.3.g.9: model MAB advertised, posteriors
  populated, cost reduction reported on canary.

## Dependencies

- `2026-05-23-substrate-explicit-vessels` (committed) —
  `llm-resolver-vessel` must exist.
- `2026-05-23-signal-confidence-weighting` (committed) — per-trace
  confidence weighting.
- `2026-05-23-cost-weighted-posteriors` (sibling) — model MAB's value
  comes from cost-weighted selection.
- `2026-05-23-substrate-forge-vessel` (sibling) — bootstrap via
  forks.

## Out of scope

- **Model fine-tuning / training**. Out of scope; the substrate
  selects among existing models, not trains new ones.
- **Cross-substrate model state sharing**. Federation-scope. H6.
- **Real-time provider failover** (model X is down → route to model
  Y). The MAB's existing β-on-failure handles this in steady state;
  real-time failover is a separate concern handled by
  `llm-resolver-vessel`'s connection layer.
- **Token-level streaming**. Model MAB is per-call; streaming behavior
  unchanged.
