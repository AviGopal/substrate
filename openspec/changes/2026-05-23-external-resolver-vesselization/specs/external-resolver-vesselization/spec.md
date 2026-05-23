# Spec — External-Resolver Vesselization

Normative requirements. Each is testable. Terminology aligned with
`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`. Section refs
inline.

## R0 — Sequencing

- **R0.1** This spec is downstream of
  `2026-05-23-substrate-forge-vessel` and
  `2026-05-23-signal-confidence-weighting`. DEV MUST NOT begin until
  both prerequisite changes have their acceptance gates green on the
  active substrate.
- **R0.2** This spec is the first of a three-spec series.
  `external-observer-vesselization` and `external-trust-weighting`
  are siblings, not phases. This spec MUST NOT depend on them and
  MUST NOT block on them.
- **R0.3** This spec does not modify the foundation document or the
  existing `forge-vessel-for-shape.json` template in place. The
  composition in design §C is expressed by a new activity template
  that references the forge template's tasks by id, not by editing
  the forge template.

## R1 — `externalResolverContract` shape

- **R1.1** A new shape `externalResolverContract` MUST be advertised
  by activity-api as a read shape (the trace store is the owner;
  observation is read-only over traces).
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
- **R1.3** `example_invocations` MUST contain at most 5 entries.
  `example_responses` MUST contain at most 5 entries.
  `sample_error_messages` MUST contain at most 3 entries per
  classification.
- **R1.4** Floors: `passes_sample_size_floor` ↔ `sample_size ≥ 50`.
  `passes_shape_stability_floor` ↔
  `output_shape.shape_stability ≥ 0.8`.
  `passes_success_rate_floor` ↔
  `success_count / sample_size ≥ 0.9`. These defaults MAY be
  overridden per substrate via operator-authored config; learned
  override is deferred to cost-weighted-posteriors.
- **R1.5** `blockers` MUST enumerate, by string id, every readiness
  predicate that is false (e.g. `["sample_size", "success_rate"]`).
  Empty array iff all three are true.
- **R1.6** `recommended_shape_name` MUST be a stable function of
  `(call_kind, target)` — recomputing the contract over the same
  data MUST yield the same name. The function SHOULD incorporate
  the target into the name (e.g. `githubPrList`, not `prList`) to
  reduce collision risk per design §H Q4.

## R2 — `observe-external-resolver` behavior

- **R2.1** The activity MUST query the activity-api trace-list
  endpoint with the §R3 filters; it MUST NOT introduce a new
  REST endpoint.
- **R2.2** The activity MUST perform target extraction per
  design §A and group traces by `(call_kind, extracted_target)`.
  Tasks whose target extraction returns null MUST be discarded.
- **R2.3** Per group, the activity MUST invoke the shape-inference
  algorithm of design §B over the input and output impulses; the
  algorithm is deterministic — two runs over the same input MUST
  produce the same output schema and the same `shape_stability`.
- **R2.4** The activity MUST emit one `externalResolverContract`
  impulse per group satisfying `sample_size ≥ min_samples`
  (default 50). Groups below the floor MAY still emit a contract
  with `passes_*` flags false; emission is at activity discretion
  but MUST NOT spuriously omit groups that satisfy the floor.
- **R2.5** The activity MUST set its trace tag
  `trace.tags ⊇ ["intent:external_resolver_observation"]` so
  trace consumers can filter substrate-initiated observation runs.

## R3 — Trace-filter query path

- **R3.1** The activity-api endpoint
  `GET /v2/activities/execution-traces` MUST accept two new
  optional query parameters: `task_resolver_id` and
  `task_resolver_target_prefix`.
- **R3.2** `task_resolver_id` MUST filter the response to traces
  containing at least one task with `tasks[].resolver_id ==
  task_resolver_id`. Implementation MAY use SurrealDB nested-
  array predicate where supported, application-side filtering
  otherwise (design §I).
- **R3.3** `task_resolver_target_prefix` MUST be returned through
  the response metadata unchanged (passed through; not applied
  server-side). Consumers apply it via target extraction
  per design §A.
- **R3.4** No schema migration is required. Both parameters operate
  over the existing `tasks[].resolver_id` field (migration 086).
- **R3.5** Both parameters MUST be optional; absent → no filter.
- **R3.6** Discovery resolver-contract metadata for activity-api
  MUST list both parameters.

## R4 — `wire-external-call-pass-through` task contract

- **R4.1** A new forge resolver `wire_external_call_pass_through`
  MUST be registered with the VesselForgeHost (or its successor)
  alongside the existing six forge resolvers.
- **R4.2** Input impulses: `externalResolverContract` (required)
  and `vesselScaffold` (required, produced by
  `scaffold_vessel_skeleton`).
- **R4.3** Output impulse: `vesselScaffoldWithProxy` body
  `{ scaffold_path: string, proxy_file_path: string,
  inferred_shape_name: string }`.
- **R4.4** The resolver MUST be deterministic — given identical
  input impulses, MUST produce a byte-identical generated file at
  `proxy_file_path`. No LLM call. No network call.
- **R4.5** The generated proxy file MUST:
  (a) compile under `tsc --noEmit` with the scaffold's tsconfig;
  (b) import only from `@avigopal/ias-executor-ts` and sibling
      scaffold files (no external runtime deps);
  (c) embed the contract impulse body as a `const CONTRACT = …`
      declaration (JSON-stringified);
  (d) compute `signal_confidence_weight` per design §E on every
      emitted impulse.
- **R4.6** The resolver MUST NOT modify any forge task other than
  by emitting `vesselScaffoldWithProxy` for the downstream
  `wire_discovery_registration` task to consume in place of
  `vesselScaffold`.

## R5 — `vesselize-external-resolver` behavior

- **R5.1** A new activity template `vesselize-external-resolver`
  MUST exist in `repos/ias-executor-ts/src/templates/
  external-resolver-vesselization/`.
- **R5.2** The task chain MUST be exactly the 9 tasks of design §C:
  the 8 tasks from `forge-vessel-for-shape` (unmodified by id)
  plus `wire_external_call_pass_through` inserted at position 4.
- **R5.3** The activity MUST accept the input variable
  `externalResolverContractId` (impulse id), reject dispatch if
  the impulse is unresolvable, and reject dispatch if the
  contract's `vesselization_readiness.blockers` is non-empty
  (unless an `--override` flag is set, which MUST emit
  `safety_breach` with `breach_type: "readiness_override"` for
  audit).
- **R5.4** On success, the activity MUST emit `vesselVerified`
  with body `{ vessel_id, shape_name, contract_id }`. Downstream
  observers learn about the new vessel via discovery
  re-registration.
- **R5.5** The activity MUST NOT modify any other vessel's
  resolver advertisements. The minted vessel advertises the
  derived shape; existing vessels continue to advertise their
  shapes unchanged.

## R6 — Coexistence with `external-validation`

- **R6.1** The existing `external-validation` resolver, its five
  validation types, its error classification, and its Thompson
  weighting MUST remain unchanged by this spec.
- **R6.2** Calls to externals that have NOT been vesselized MUST
  continue to route through the generic resolvers (`shell-exec`,
  `http-fetch`, `external-validation`) with no regression in
  trace shape, posterior update, or error reporting.
- **R6.3** Calls to externals that HAVE been vesselized MUST be
  routed by the standard discovery shape-lookup path; the minted
  vessel becomes the producer-of-record for the derived shape.
- **R6.4** A minted vessel's proxy MUST itself invoke the
  underlying generic resolver to execute the external call. The
  proxy does not duplicate the generic resolver's logic.
- **R6.5** Removing or retiring a minted vessel MUST restore
  routing to the generic resolver with no other change.

## R7 — Confidence weighting on external-vessel impulses

- **R7.1** Every impulse emitted by a vesselized external resolver
  MUST carry `signal_confidence_weight` populated per design §E:
  `base × shape_stability × observed_success_rate`, clamped to
  [0.3, 0.7].
- **R7.2** `base` MUST default to 0.7 (the external-source ceiling
  from the trust-weighting sibling). Operators MAY override via
  per-vessel config.
- **R7.3** `observed_success_rate` MUST be recomputed by the proxy
  at resolve time, sliding-window over the most recent 100 calls.
  On cold start, the contract's `success_count / sample_size` is
  used.
- **R7.4** Posterior updates triggered by these impulses use
  `signal_confidence_weight` as the multiplier per
  `signal-confidence-weighting/spec.md`. No additional weight
  layering by this spec.

## R8 — Acceptance

- **R8.1** R1–R7 contract tests all green.
- **R8.2** **Canary**: gh-CLI end-to-end per tasks §6.
  - 6.1–6.3: contract emitted with
    `recommended_shape_name = "githubPrList"`,
    `sample_size ≥ 50`, all three `passes_*` true.
  - 6.4: forge pipeline reaches `vesselVerified`.
  - 6.5: subsequent `gh pr list` calls route through the minted
    vessel with `signal_confidence_weight ∈ [0.3, 0.7]`.
  - 6.6: an un-vesselized external continues to route through
    the generic resolver.
- **R8.3** Closure: `closure-audit --without=operator-shell`
  reports zero failures for the observe → vesselize pipeline
  across 3 consecutive runs.
- **R8.4** Trace-filter primitive contract test (tasks §1.3)
  green across both planner-pushdown and application-fallback
  paths.

## Status

Post-substrate-forge-vessel. Lands after forge is stable. Pre-
external-observer-vesselization and external-trust-weighting
(siblings; this spec does not depend on them).
