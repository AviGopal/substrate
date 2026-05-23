## ADDED Requirements

### Requirement: probe-external-resolver template exists in development-vessel

The development-vessel SHALL ship a seed template `probe-external-resolver` that consumes a `resolverCandidate` impulse and produces a `probeReport` impulse describing the inferred input/output shapes, error modes, and latency of an external HTTP resolver.

#### Scenario: Operator-driven probe against documented API

- **WHEN** operator invokes `bun run cli execute probe-external-resolver` with `candidate_url=https://api.perplexity.ai/chat/completions`, `auth_secret_path=~/.metabob/perplexity-secret`, and `descriptor_url` omitted
- **THEN** the template plans a probe battery via `llm_completion_dispatch`
- **AND** executes each probe through `http_request`
- **AND** emits a single `probeReport` impulse whose `observed_endpoints` contains at least one entry with non-empty `inferred_input_shape` and `inferred_output_shape`

#### Scenario: Probe against unreachable candidate

- **WHEN** the candidate URL returns connection-refused on all probes
- **THEN** the template records a `failure_mode.type="verifier_negative"` with `context.reason="candidate_unreachable"`
- **AND** does NOT emit a `probeReport` impulse

#### Scenario: Probe battery exceeds budget

- **WHEN** total LLM + HTTP cost during execution exceeds the configured `MAX_PROBE_BUDGET_USD`
- **THEN** the template halts after the current probe
- **AND** records `failure_mode.type="budget_exhausted"` with `context.consumed` and `context.allowed`

### Requirement: probeReport shape is registered

The `probeReport` shape SHALL be declared in `docs/shapes/README.md` and resolvable by development-vessel via discovery-vessel advertisement.

#### Scenario: probeReport visible via discovery

- **WHEN** a consumer queries discovery-vessel `/resolve` for shape `probeReport`
- **THEN** the response includes development-vessel as a resolver

### Requirement: Traces are tagged at the discovery horizon

Every execution of `probe-external-resolver` SHALL produce a trace whose `trace.tags` set is a superset of `["intent:external_resolver_discovery", "intent:external_resolver_probing"]`. The horizon tag (`external_resolver_discovery`) places the trace under the discovery horizon; the sub-intent (`external_resolver_probing`) identifies the activity. The tags are additive so a single ribosome filter on the horizon tag captures every sibling at this horizon (probe-driven, trace-driven, MCP-registry-driven, …).

#### Scenario: Successful probe carries both tags

- **WHEN** `probe-external-resolver` completes and emits a `probeReport`
- **THEN** the trace's `tags` includes both `intent:external_resolver_discovery` and `intent:external_resolver_probing`

#### Scenario: Failed probe still carries both tags

- **WHEN** `probe-external-resolver` aborts with any `failure_mode`
- **THEN** the trace's `tags` still includes both tags so failure posteriors at the discovery horizon include the abort
