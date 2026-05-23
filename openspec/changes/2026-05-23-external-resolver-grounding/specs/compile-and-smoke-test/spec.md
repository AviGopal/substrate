## ADDED Requirements

### Requirement: compile-and-smoke-test template exists in development-vessel

The development-vessel SHALL ship a seed template `compile-and-smoke-test` that consumes a `vesselScaffold` and the originating `probeReport` and emits a `scaffoldHealth` impulse covering install, lint, test, boot, probe-self, and shutdown stages.

#### Scenario: Healthy scaffold passes all stages

- **WHEN** the template runs against a Perplexity scaffold whose `bun install && bun run lint && bun test` all succeed and whose boot binds an ephemeral port
- **THEN** the emitted `scaffoldHealth` has `passed: true`
- **AND** every stage in `stages` reports `passed: true`
- **AND** at least 80% of `probe.per_probe` entries have `passed: true`

#### Scenario: Lint failure short-circuits later stages

- **WHEN** the `lint` stage exits non-zero
- **THEN** `test`, `boot`, and `probe-self` stages are skipped
- **AND** the emitted `scaffoldHealth` has `passed: false`
- **AND** `stages.lint.passed` is `false` while `stages.test.passed` is absent or `false` with `reason="upstream_failed"`

#### Scenario: Shutdown runs even on upstream failure

- **WHEN** any earlier stage fails while a vessel process is bound to a port
- **THEN** the `shutdown` task runs and terminates the bound process
- **AND** `stages.shutdown.passed` reflects the actual shutdown outcome

#### Scenario: Probe responses drift from declared shape

- **WHEN** more than 50% of smoke probes return responses whose conformance against `probeReport.observed_endpoints[].inferred_output_shape` is below 0.8
- **THEN** the emitted `scaffoldHealth.stages.probe.passed` is `false`
- **AND** the scaffold is considered failed regardless of other stages

### Requirement: Traces are tagged at the discovery horizon

Every execution of `compile-and-smoke-test` SHALL produce a trace whose `trace.tags` set is a superset of `["intent:external_resolver_discovery", "intent:external_resolver_smoke_testing"]`.

#### Scenario: Smoke-test trace carries both tags

- **WHEN** the template runs to completion (passed or failed)
- **THEN** the trace's `tags` includes both `intent:external_resolver_discovery` and `intent:external_resolver_smoke_testing`
