# Spec — External-Resolver Vesselization

Normative requirements. Each is testable. Terminology aligned with
`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`. Section refs
inline.

## ADDED Requirements

### Requirement: R0 — Sequencing and horizon framing

This spec MUST be sequenced behind its prerequisites and MUST operate at the **discovery horizon** as defined by the four-primitive model applied recursively (foundation §812–823). The horizon framing is what makes this spec a sibling — not a successor — to `2026-05-23-external-resolver-grounding`.

- **R0.1** This spec is downstream of `2026-05-23-substrate-forge-vessel` and `2026-05-23-signal-confidence-weighting`. DEV MUST NOT begin until both prerequisite changes have their acceptance gates green on the active substrate.
- **R0.2** This spec is the first of a three-spec series. `external-observer-vesselization` and `external-trust-weighting` are siblings, not phases. This spec MUST NOT depend on them and MUST NOT block on them.
- **R0.3** This spec does not modify the foundation document or the existing `forge-vessel-for-shape.json` template in place. The composition in design §C is expressed by a new activity template that references the forge template's tasks by id, not by editing the forge template.
- **R0.4** Every activity introduced by this spec MUST tag its traces with the horizon tag `intent:external_resolver_discovery` plus an activity-specific sub-intent (e.g. `external_resolver_observation`, `external_resolver_minting`). The horizon tag is shared with the probe-driven sibling `2026-05-23-external-resolver-grounding` so a ribosome filter on the horizon tag captures both siblings' traces without privileging either.
- **R0.5** Every trace produced by this spec MUST carry the horizon tag (R0.4). Consumers (ribosome, posterior aggregators, audit activities) MAY filter traces by tag to compute per-horizon analyses; per-horizon and cross-horizon analyses are both legitimate and use the same query mechanism. This spec does NOT introduce horizon as a first-class parameter or storage partition — horizons are a tag-namespace convention over the existing trace-tag set.

#### Scenario: Prerequisites green before DEV

- **WHEN** an operator runs the acceptance gate query for `2026-05-23-substrate-forge-vessel` and `2026-05-23-signal-confidence-weighting`
- **THEN** both report green before any task in this change is dispatched

#### Scenario: All activities carry the horizon tag

- **WHEN** any activity introduced by this spec (`observe-external-resolver`, `wire_external_call_pass_through`, `vesselize-external-resolver`) completes
- **THEN** its trace's `tags` includes `intent:external_resolver_discovery`
- **AND** also includes at least one sub-intent specific to that activity

#### Scenario: Horizon-filtered aggregation excludes other horizons

- **WHEN** a ribosome aggregation runs filtered on `intent:external_resolver_discovery`
- **THEN** the aggregated trace set includes ONLY traces carrying that tag
- **AND** the aggregation result is computed solely from that set

#### Scenario: Cross-horizon aggregation is the same mechanism

- **WHEN** a consumer runs the same aggregation without a tag filter, or with a union of tags
- **THEN** the aggregation runs through the same query path with no special-cased code
- **AND** the result is the cross-horizon analysis

### Requirement: R1 — `externalResolverContract` shape

A new shape `externalResolverContract` MUST be advertised by activity-api with a stable, fully-typed body covering contract identity, sample statistics, inferred input/output shapes, operational characteristics, and a vesselization-readiness sub-record.

- **R1.1** The shape MUST be advertised by activity-api as a read shape (the trace store is the owner; observation is read-only over traces).
- **R1.2** The body MUST conform to:
  ```typescript
  {
    generated_at: string;            // ISO 8601
    observation_window_seconds: number;
    call_kind: "shell_exec" | "http_fetch" | "external_validation"
             | "mcp_call" | string;  // open for future resolver kinds
    target: string;
    sample_size: number;
    success_count: number;
    failure_count: number;
    input_shape: {
      schema_inferred: Record<string, unknown>;
      example_invocations: Array<Record<string, unknown>>;
    };
    output_shape: {
      schema_inferred: Record<string, unknown>;
      example_responses: Array<Record<string, unknown>>;
      shape_stability: number;       // [0, 1]
    };
    latency_p50_ms: number;
    latency_p95_ms: number;
    cost_per_call_usd: number;
    failure_modes: Array<{
      classification: string;
      rate: number;
      sample_error_messages: string[];
    }>;
    vesselization_readiness: {
      passes_sample_size_floor: boolean;
      passes_shape_stability_floor: boolean;
      passes_success_rate_floor: boolean;
      recommended_vessel_name: string;
      recommended_shape_name: string;
      blockers: string[];
    };
  }
  ```
- **R1.3** `example_invocations` MUST contain at most 5 entries. `example_responses` MUST contain at most 5 entries. `sample_error_messages` MUST contain at most 3 entries per classification.
- **R1.4** Floors: `passes_sample_size_floor` ↔ `sample_size ≥ 50`. `passes_shape_stability_floor` ↔ `output_shape.shape_stability ≥ 0.8`. `passes_success_rate_floor` ↔ `success_count / sample_size ≥ 0.9`. These defaults MAY be overridden per substrate via operator-authored config; learned override is deferred to cost-weighted-posteriors.
- **R1.5** `blockers` MUST enumerate, by string id, every readiness predicate that is false (e.g. `["sample_size", "success_rate"]`). Empty array iff all three are true.
- **R1.6** `recommended_shape_name` MUST be a stable function of `(call_kind, target)` — recomputing the contract over the same data MUST yield the same name. The function SHOULD incorporate the target into the name (e.g. `githubPrList`, not `prList`) to reduce collision risk per design §H Q4.

#### Scenario: Discovery returns the shape

- **WHEN** a consumer queries discovery-vessel `/resolve` for shape `externalResolverContract`
- **THEN** the response includes activity-api as a resolver

#### Scenario: All three floors pass produce empty blockers

- **WHEN** an observation produces `sample_size=120`, `shape_stability=0.95`, and `success_count/sample_size=0.92`
- **THEN** all three `passes_*` flags are `true` and `blockers` is the empty array

#### Scenario: Stable naming under recomputation

- **WHEN** the same trace set is fed through observation twice
- **THEN** both runs produce the same `recommended_shape_name` and the same `recommended_vessel_name`

### Requirement: R2 — `observe-external-resolver` behavior

The `observe-external-resolver` activity MUST consume the trace-list endpoint, perform deterministic target extraction and shape inference, and emit one contract per qualifying group.

- **R2.1** The activity MUST query the activity-api trace-list endpoint with the R3 filters; it MUST NOT introduce a new REST endpoint.
- **R2.2** The activity MUST perform target extraction per design §A and group traces by `(call_kind, extracted_target)`. Tasks whose target extraction returns null MUST be discarded.
- **R2.3** Per group, the activity MUST invoke the shape-inference algorithm of design §B over the input and output impulses; the algorithm is deterministic — two runs over the same input MUST produce the same output schema and the same `shape_stability`.
- **R2.4** The activity MUST emit one `externalResolverContract` impulse per group satisfying `sample_size ≥ min_samples` (default 50). Groups below the floor MAY still emit a contract with `passes_*` flags false; emission is at activity discretion but MUST NOT spuriously omit groups that satisfy the floor.
- **R2.5** The activity MUST set its trace tag `trace.tags ⊇ ["intent:external_resolver_discovery", "intent:external_resolver_observation"]` per R0.4 so ribosome filters at the discovery horizon include this activity's traces.

#### Scenario: Qualifying group produces a contract

- **WHEN** the trace store contains 120 successful traces with `resolver_id="shell-exec"` and extracted target `gh pr list`, with stable output shape
- **THEN** `observe-external-resolver` emits one `externalResolverContract` for that group
- **AND** the contract's `vesselization_readiness.blockers` is the empty array

#### Scenario: Deterministic shape inference

- **WHEN** `observe-external-resolver` runs twice over an identical trace slice
- **THEN** both runs produce contracts whose `output_shape.schema_inferred` and `output_shape.shape_stability` are byte-identical

### Requirement: R3 — Trace-filter query path

The activity-api `/v2/activities/execution-traces` endpoint MUST accept new filter parameters that group traces by `(resolver_id, target)` for the observation activity to consume.

- **R3.1** The endpoint MUST accept two new optional query parameters: `task_resolver_id` and `task_resolver_target_prefix`.
- **R3.2** `task_resolver_id` MUST filter the response to traces containing at least one task with `tasks[].resolver_id == task_resolver_id`. Implementation MAY use SurrealDB nested-array predicate where supported, application-side filtering otherwise (design §I).
- **R3.3** `task_resolver_target_prefix` MUST be returned through the response metadata unchanged (passed through; not applied server-side). Consumers apply it via target extraction per design §A.
- **R3.4** No schema migration is required. Both parameters operate over the existing `tasks[].resolver_id` field (migration 086).
- **R3.5** Both parameters MUST be optional; absent → no filter.
- **R3.6** Discovery resolver-contract metadata for activity-api MUST list both parameters.

#### Scenario: Filter narrows to one resolver

- **WHEN** a caller queries `/v2/activities/execution-traces?task_resolver_id=shell-exec`
- **THEN** every returned trace contains at least one task with `tasks[].resolver_id="shell-exec"`

#### Scenario: Filter is backward-compatible when omitted

- **WHEN** a caller queries `/v2/activities/execution-traces` without the new parameters
- **THEN** the response matches the pre-existing endpoint contract

### Requirement: R4 — `wire-external-call-pass-through` task contract

A new forge resolver `wire_external_call_pass_through` MUST be registered with the VesselForgeHost; it MUST consume an `externalResolverContract` and a `vesselScaffold` and emit a `vesselScaffoldWithProxy` whose generated proxy file is deterministic, dependency-free, and self-contained.

- **R4.1** The resolver MUST be registered with the VesselForgeHost (or its successor) alongside the existing six forge resolvers.
- **R4.2** Input impulses: `externalResolverContract` (required) and `vesselScaffold` (required, produced by `scaffold_vessel_skeleton`).
- **R4.3** Output impulse: `vesselScaffoldWithProxy` body `{ scaffold_path: string, proxy_file_path: string, inferred_shape_name: string }`.
- **R4.4** The resolver MUST be deterministic — given identical input impulses, it MUST produce a byte-identical generated file at `proxy_file_path`. No LLM call. No network call.
- **R4.5** The generated proxy file MUST:
  (a) compile under `tsc --noEmit` with the scaffold's tsconfig;
  (b) import only from `@avigopal/ias-executor-ts` and sibling scaffold files (no external runtime deps);
  (c) embed the contract impulse body as a `const CONTRACT = …` declaration (JSON-stringified);
  (d) compute `signal_confidence_weight` per design §E on every emitted impulse.
- **R4.6** The resolver MUST NOT modify any forge task other than by emitting `vesselScaffoldWithProxy` for the downstream `wire_discovery_registration` task to consume in place of `vesselScaffold`.

#### Scenario: Byte-identical re-runs

- **WHEN** the resolver runs twice with identical input impulses
- **THEN** the generated file at `proxy_file_path` is byte-identical across both runs

#### Scenario: Generated proxy is dependency-clean

- **WHEN** the generated proxy file is compiled under the scaffold's tsconfig with `tsc --noEmit`
- **THEN** compilation succeeds with no `Cannot find module` errors for any non-`@avigopal/ias-executor-ts` import

### Requirement: R5 — `vesselize-external-resolver` behavior

A new activity template `vesselize-external-resolver` MUST compose the existing forge pipeline with the new proxy-wiring task, accept a contract impulse id, refuse to mint when readiness blockers are present (modulo an audited override), and emit a `vesselVerified` impulse on success.

- **R5.1** The template MUST exist in `repos/ias-executor-ts/src/templates/external-resolver-vesselization/`.
- **R5.2** The task chain MUST be exactly the 9 tasks of design §C: the 8 tasks from `forge-vessel-for-shape` (unmodified by id) plus `wire_external_call_pass_through` inserted at position 4.
- **R5.3** The activity MUST accept the input variable `externalResolverContractId` (impulse id), reject dispatch if the impulse is unresolvable, and reject dispatch if the contract's `vesselization_readiness.blockers` is non-empty (unless an `--override` flag is set, which MUST emit `safety_breach` with `breach_type: "readiness_override"` for audit).
- **R5.4** On success, the activity MUST emit `vesselVerified` with body `{ vessel_id, shape_name, contract_id }`. Downstream observers learn about the new vessel via discovery re-registration.
- **R5.5** The activity MUST NOT modify any other vessel's resolver advertisements. The minted vessel advertises the derived shape; existing vessels continue to advertise their shapes unchanged.
- **R5.6** Traces MUST carry `trace.tags ⊇ ["intent:external_resolver_discovery", "intent:external_resolver_minting"]` per R0.4.

#### Scenario: Refusal on non-empty blockers

- **WHEN** the activity is dispatched with a contract whose `vesselization_readiness.blockers=["sample_size"]` and no `--override`
- **THEN** the activity refuses dispatch
- **AND** records a `failure_mode.type="verifier_negative"` with `context.validator_id="vesselization_readiness"`

#### Scenario: Audited override path

- **WHEN** the activity is dispatched with a non-empty-blockers contract AND `--override`
- **THEN** the activity proceeds
- **AND** emits `failure_mode.type="safety_breach"` with `breach_type="readiness_override"` for audit

#### Scenario: Success emits vesselVerified

- **WHEN** the activity completes against a clean-readiness contract
- **THEN** a `vesselVerified` impulse is emitted with `vessel_id`, `shape_name`, and `contract_id` populated

### Requirement: R6 — Coexistence with `external-validation`

Generic external-call resolvers MUST continue to serve any external whose target has not been vesselized. Vesselization MUST be the lift-out path, not a replacement.

- **R6.1** The existing `external-validation` resolver, its five validation types, its error classification, and its Thompson weighting MUST remain unchanged by this spec.
- **R6.2** Calls to externals that have NOT been vesselized MUST continue to route through the generic resolvers (`shell-exec`, `http-fetch`, `external-validation`) with no regression in trace shape, posterior update, or error reporting.
- **R6.3** Calls to externals that HAVE been vesselized MUST be routed by the standard discovery shape-lookup path; the minted vessel becomes the producer-of-record for the derived shape.
- **R6.4** A minted vessel's proxy MUST itself invoke the underlying generic resolver to execute the external call. The proxy does not duplicate the generic resolver's logic.
- **R6.5** Removing or retiring a minted vessel MUST restore routing to the generic resolver with no other change.

#### Scenario: Unvesselized target served by generic

- **WHEN** a task calls a shell command whose target has not been vesselized
- **THEN** `shell-exec` resolves the call as before
- **AND** the trace records `resolver_id="shell-exec"`

#### Scenario: Vesselized target served by mint

- **WHEN** a task requests an impulse whose shape is owned by a minted vessel
- **THEN** discovery routes the resolution to the minted vessel
- **AND** the trace records the minted vessel's `vessel_id`

#### Scenario: Retiring a mint restores generic routing

- **WHEN** an operator deregisters a minted vessel
- **THEN** subsequent calls for the previously-vesselized target route through the generic resolver
- **AND** no other vessel advertisements change

### Requirement: R7 — Confidence weighting on external-vessel impulses

Every impulse emitted by a vesselized external resolver MUST carry `signal_confidence_weight` populated per the design formula and clamped to the external-source range.

- **R7.1** `signal_confidence_weight = base × shape_stability × observed_success_rate`, clamped to `[0.3, 0.7]`.
- **R7.2** `base` MUST default to 0.7 (the external-source ceiling from the trust-weighting sibling). Operators MAY override via per-vessel config.
- **R7.3** `observed_success_rate` MUST be recomputed by the proxy at resolve time, sliding-window over the most recent 100 calls. On cold start, the contract's `success_count / sample_size` is used.
- **R7.4** Posterior updates triggered by these impulses use `signal_confidence_weight` as the multiplier per `signal-confidence-weighting/spec.md`. No additional weight layering by this spec.

#### Scenario: Weight respects external-source ceiling

- **WHEN** a minted vessel resolves an impulse
- **THEN** the returned impulse's `signal_confidence_weight` is in `[0.3, 0.7]`

#### Scenario: Sliding-window recomputation

- **WHEN** a minted vessel has handled ≥ 100 calls
- **THEN** the next emitted impulse's `signal_confidence_weight` reflects the most recent 100 calls, not the originating contract's success rate

### Requirement: R8 — Acceptance

The change MUST be accepted only when R1–R7 contract tests pass, the gh-CLI canary completes end-to-end, closure-audit reports zero failures across three consecutive runs, and the trace-filter primitive is exercised across both query paths.

- **R8.1** R1–R7 contract tests all green.
- **R8.2** **Canary**: gh-CLI end-to-end per tasks §6.
  - 6.1–6.3: contract emitted with `recommended_shape_name = "githubPrList"`, `sample_size ≥ 50`, all three `passes_*` true.
  - 6.4: forge pipeline reaches `vesselVerified`.
  - 6.5: subsequent `gh pr list` calls route through the minted vessel with `signal_confidence_weight ∈ [0.3, 0.7]`.
  - 6.6: an un-vesselized external continues to route through the generic resolver.
- **R8.3** Closure: `closure-audit --without=operator-shell` reports zero failures for the observe → vesselize pipeline across 3 consecutive runs.
- **R8.4** Trace-filter primitive contract test (tasks §1.3) green across both planner-pushdown and application-fallback paths.

#### Scenario: gh-CLI end-to-end canary passes

- **WHEN** the operator runs the gh-CLI canary harness per tasks §6
- **THEN** all six sub-steps (6.1 through 6.6) pass within one cycle

#### Scenario: Closure audit clean across three runs

- **WHEN** `closure-audit --without=operator-shell` is executed three times in succession against the observe → vesselize pipeline
- **THEN** zero failures are reported across all three runs

## Status

Post-substrate-forge-vessel. Lands after forge is stable. Pre-`external-observer-vesselization` and `external-trust-weighting` (siblings; this spec does not depend on them).
