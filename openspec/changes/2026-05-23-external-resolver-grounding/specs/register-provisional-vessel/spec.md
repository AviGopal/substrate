## ADDED Requirements

### Requirement: register-provisional-vessel template exists in development-vessel

The development-vessel SHALL ship a seed template `register-provisional-vessel` that consumes a `vesselScaffold` plus its `scaffoldHealth` and registers the scaffold with discovery-vessel under `provisional: true`, emitting a `provisionalRegistration` impulse.

#### Scenario: Healthy scaffold is registered provisionally

- **WHEN** the template runs with a `scaffoldHealth` whose `passed: true`
- **THEN** the template POSTs to `discovery-vessel/register` with `provisional: true` and the scaffold's declared shapes
- **AND** emits a `provisionalRegistration` impulse containing the assigned `vessel_id`, `registered_shapes`, and the active `promotion_criterion`

#### Scenario: Unhealthy scaffold blocked at precheck

- **WHEN** the template runs with a `scaffoldHealth` whose `passed: false`
- **THEN** the `precheck` task aborts
- **AND** the template records `failure_mode.type="cascading"` with `context.upstream_task_id="compile-and-smoke-test"`
- **AND** does NOT call discovery-vessel `/register`

#### Scenario: Discovery-vessel lacks provisional field

- **WHEN** discovery-vessel's echoed registration payload omits the `provisional` field
- **THEN** the template records `failure_mode.type="safety_breach"` with `context.breach_type="discovery_vessel_missing_provisional_field"`
- **AND** the operator is signalled to upgrade discovery-vessel before retry

### Requirement: discovery-vessel accepts `provisional` field

discovery-vessel `/register` SHALL accept an optional `provisional: boolean` field (default false), an optional `provisional_since` ISO-timestamp, and an optional `promotion_criterion` object. The registry record SHALL preserve all three for read-back via `/vessels/:id`.

#### Scenario: Backward-compatible registration

- **WHEN** a caller registers without the `provisional` field
- **THEN** discovery-vessel treats the vessel as stable (`provisional: false`)

#### Scenario: Provisional vessels down-weighted in selection

- **WHEN** `discover-by-shapes candidates_with_scores` returns candidates including a provisional vessel
- **THEN** the provisional vessel's score is multiplied by the configured `PROVISIONAL_WEIGHT` (default 0.5) before ranking

### Requirement: Traces are tagged at the discovery horizon

Every execution of `register-provisional-vessel` SHALL produce a trace whose `trace.tags` set is a superset of `["intent:external_resolver_discovery", "intent:external_resolver_registration"]`. The provisional flag on discovery-vessel is orthogonal to the horizon tag: provisional captures trust-under-thin-evidence (per the down-weight scenario above), the horizon tag captures the producing context. A vessel minted by the trace-driven sibling at the same horizon may also be registered provisionally and is identified by the same horizon tag — the operator distinguishes producers via the sub-intent.

#### Scenario: Registration trace carries both tags

- **WHEN** the template runs to completion
- **THEN** the trace's `tags` includes both `intent:external_resolver_discovery` and `intent:external_resolver_registration`
