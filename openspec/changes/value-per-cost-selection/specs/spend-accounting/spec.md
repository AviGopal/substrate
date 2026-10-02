## ADDED Requirements

### Requirement: Every LLM call reports its cost
llm-resolver SHALL return `usage` with `input_tokens`, `output_tokens` and `cost_usd` on
every completion, including the credit-fallback path, computing `cost_usd` from the
provider-reported cost when present and otherwise from the serving arm's `cost_per_mtok`.
It SHALL accept `execution_id` and `dispatch_id` on the request and emit one `llmSpend`
impulse per call carrying model, provider, task type, tokens, cost and both ids.

#### Scenario: Completion carries cost
- **WHEN** any caller resolves `llm_completion` and a provider serves it
- **THEN** the response's `usage.cost_usd` is a number greater than 0 for a non-free model, and one `llmSpend` impulse with the same tokens and ids is emitted

#### Scenario: Fallback path is not free by omission
- **WHEN** the credit-fallback path serves a completion
- **THEN** the response carries `usage` (tokens and cost), never an absent usage

### Requirement: Composes and executions record their cost
feature_compose SHALL accumulate `{input_tokens, output_tokens, calls, cost_usd}` per stage
across every LLM call it makes and write the totals into its compose report and its
attempt outcome. goal-host SHALL key usage by dispatch id, count LLM calls, and stamp
`{tokens_in, tokens_out, llm_calls, cost_usd, wall_ms}` on the dispatch record and on the
execution traces it persists, replacing every hard-coded `cost_usd: 0`.

#### Scenario: A compose that drafted has non-zero cost
- **WHEN** a feature_compose run makes at least one LLM call
- **THEN** its compose report's `tokens` are non-zero and equal the sum of that run's `llmSpend` impulses

#### Scenario: Execution rows stop reading zero
- **WHEN** a goal walk that called the LLM completes
- **THEN** its execution row's `tokens_in` and `cost_usd` are non-zero
