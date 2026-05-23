## ADDED Requirements

### Requirement: promote-vessel template exists in development-vessel

The development-vessel SHALL ship a seed template `promote-vessel` that, given a `provisionalRegistration` impulse, reads recent execution traces for that vessel, evaluates them against the captured `promotion_criterion`, and either promotes the vessel (clears `provisional`), demotes it (zeroes its selection weight), or holds.

#### Scenario: Promotion when criterion clears

- **WHEN** the template runs against a vessel with trace_count ≥ `min_traces`, success_rate ≥ `min_success_rate`, and shape_drift ≤ `max_shape_drift`
- **THEN** the template PATCHes discovery-vessel `/vessels/:id` with `provisional: false`
- **AND** emits a `vesselPromotion` impulse with `decision: "promote"` and the supporting `stats`

#### Scenario: Hold when traces insufficient

- **WHEN** trace_count is below `min_traces` regardless of success_rate
- **THEN** the template emits `vesselPromotion` with `decision: "hold"`
- **AND** does NOT call discovery-vessel PATCH

#### Scenario: Demotion when success_rate collapses

- **WHEN** success_rate is below 0.3 across the trace window
- **THEN** the template PATCHes discovery-vessel with `provisional_weight: 0.0`
- **AND** emits `vesselPromotion` with `decision: "demote"`

#### Scenario: Idempotent re-run on already-promoted vessel

- **WHEN** the template runs against a vessel whose `provisional` is already `false`
- **THEN** the template emits `vesselPromotion` with the current stats
- **AND** does NOT call discovery-vessel PATCH a second time
- **AND** records `failure_mode.type="cascading"` only if the underlying read failed

### Requirement: Promotion criterion is captured at registration

The `promotion_criterion` stored on the discovery-vessel record at registration time SHALL be the criterion used by `promote-vessel` for that vessel. Changing the default thresholds in development-vessel config SHALL NOT retroactively affect already-registered provisional vessels.

#### Scenario: Existing vessel keeps its original criterion

- **WHEN** an operator changes the default `min_traces` from 20 to 50 after a vessel has been registered with `min_traces=20`
- **THEN** `promote-vessel` evaluates that vessel against `min_traces=20`

### Requirement: Traces are tagged at the discovery horizon

Every execution of `promote-vessel` SHALL produce a trace whose `trace.tags` set is a superset of `["intent:external_resolver_discovery", "intent:external_resolver_promotion"]`. The promotion decision (promote / hold / demote) and the resulting `vesselPromotion` impulse SHALL be recorded under the discovery horizon so that ribosome and Thompson aggregation at that horizon include promotion outcomes — not only the upstream probe/scaffold/register outcomes.

#### Scenario: Promotion trace carries both tags

- **WHEN** the template emits a `vesselPromotion` impulse with any decision
- **THEN** the trace's `tags` includes both `intent:external_resolver_discovery` and `intent:external_resolver_promotion`
