## ADDED Requirements

### Requirement: synthesize-vessel-scaffold template exists in development-vessel

The development-vessel SHALL ship a seed template `synthesize-vessel-scaffold` that consumes a `probeReport` impulse and produces a `vesselScaffold` impulse plus on-disk source files matching `docs/architecture/TYPESCRIPT_VESSEL_TEMPLATE.md` under `repos/<candidate_name>-vessel/`.

#### Scenario: Scaffold generated from Perplexity probeReport

- **WHEN** the template runs with a `probeReport` for `candidate_name=perplexity`
- **THEN** the template dispatches to `llm_completion` with the template doc and probeReport as input context
- **AND** writes scaffold files under `repos/perplexity-vessel/`
- **AND** emits a `vesselScaffold` impulse listing every written file with its sha256

#### Scenario: Write outside scaffold directory rejected

- **WHEN** the LLM draft attempts to write a file whose path does not begin with `repos/<candidate_name>-vessel/`
- **THEN** the `write-files` task rejects the write
- **AND** records `failure_mode.type="safety_breach"` with `context.breach_type="path_prefix_violation"`

#### Scenario: LLM returns malformed JSON

- **WHEN** the `draft-source` task receives an LLM response that cannot be parsed into a `path → contents` map
- **THEN** the template records `failure_mode.type="verifier_negative"` with `context.failed_evidence[].validator_id="llm_response_parse"`
- **AND** does NOT write any files

### Requirement: Traces are tagged at the discovery horizon

Every execution of `synthesize-vessel-scaffold` SHALL produce a trace whose `trace.tags` set is a superset of `["intent:external_resolver_discovery", "intent:external_resolver_scaffolding"]`. The horizon tag is shared with sibling discovery activities; the sub-intent identifies the scaffolding step within the discovery-horizon pipeline.

#### Scenario: Scaffold trace carries both tags

- **WHEN** the template runs to completion (successfully or with a `failure_mode`)
- **THEN** the trace's `tags` includes both `intent:external_resolver_discovery` and `intent:external_resolver_scaffolding`

### Requirement: Scaffold uses operator-readable prompt

The LLM prompt used to draft the scaffold SHALL live in `repos/development-vessel/src/seed/prompts/synthesize-vessel.md` and not be inlined in TypeScript source.

#### Scenario: Prompt is operator-editable

- **WHEN** an operator edits the prompt file and re-runs the template
- **THEN** the new prompt is used without recompiling development-vessel
