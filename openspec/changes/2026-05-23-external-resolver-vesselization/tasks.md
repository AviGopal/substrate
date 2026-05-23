# Tasks: External-Resolver Vesselization

## Phase 1 — Trace-filter primitives

- [ ] 1.1 Add `task_resolver_id` query parameter to
  `GET /v2/activities/execution-traces` in
  `repos/metabob-activity-api/src/routes/execution-traces.ts`.
  Implement via SurrealDB nested-array predicate where supported;
  fall back to application-side filtering per design §I.
- [ ] 1.2 Add `task_resolver_target_prefix` query parameter as a
  documented hint passed through to the response unchanged
  (consumed by `observe-external-resolver` at scan time, not by
  SurrealDB). Document the rationale inline.
- [ ] 1.3 Contract test in
  `repos/metabob-activity-api/test/execution-traces-filter.test.ts`
  covering both the happy path (filter returns matching traces) and
  the fallback path (broad fetch + post-filter when the planner
  refuses the nested predicate).
- [ ] 1.4 Update activity-api discovery resolver-contract metadata
  to advertise the two new query parameters.

## Phase 2 — Shape inference engine

- [ ] 2.1 New module
  `repos/ias-executor-ts/src/lib/shape-inference.ts` implementing
  the algorithm in design §B (pessimistic-union + optional-field
  detection + type-variance unrolling).
- [ ] 2.2 Pure-function unit tests over a fixture corpus covering:
  (a) homogeneous-shape inputs producing required-fields only;
  (b) optional-field detection at the 50–99% threshold;
  (c) type-variance penalty in `shape_stability`;
  (d) rejected non-JSON inputs;
  (e) nested object recursion;
  (f) array element unification.
- [ ] 2.3 `shape_stability` scoring function with the design §B
  formula, clamped to [0, 1]. Exported separately for use in §3
  contract emission.

## Phase 3 — `observe-external-resolver` activity

- [ ] 3.1 New activity template `observe-external-resolver` in
  `repos/ias-executor-ts/src/templates/external-resolver-
  vesselization/`. Variables:
  `call_kind`, `target_prefix`, `lookback_seconds` (default
  604800), `min_samples` (default 50).
- [ ] 3.2 Task chain:
  (1) `fetch_traces` — calls trace-list endpoint with §1 filters;
  (2) `extract_targets` — applies the design §A target extractor;
  (3) `group_and_infer` — groups by `(call_kind, target)` and
  invokes §2 shape inference per group;
  (4) `score_readiness` — applies sample-size, shape-stability, and
  success-rate floors;
  (5) `emit_contract` — emits `externalResolverContract` impulse(s)
  per group meeting the minimum sample size.
- [ ] 3.3 Output impulse contract per the spec §R1 schema.
- [ ] 3.4 Tests against a synthetic trace fixture
  (`test/fixtures/gh-pr-list-traces.json`) emitting a contract
  with `recommended_shape_name = "githubPrList"`.

## Phase 4 — `wire-external-call-pass-through` task

- [ ] 4.1 New forge resolver
  `wire_external_call_pass_through` in
  `repos/ias-executor-ts/src/examples/vessel-forge-host.ts`
  (or its successor host).
- [ ] 4.2 Code-template generator that emits
  `src/resolvers/external-proxy.ts` and `src/resolvers/
  dispatch-generic.ts` into the scaffold per design §D.
- [ ] 4.3 Embedded-contract serialization: contract JSON
  serialized into the proxy file as a `const CONTRACT = …`
  declaration. No runtime activity-api lookup.
- [ ] 4.4 `signal_confidence_weight` computation embedded per
  design §E formula with the [0.3, 0.7] clamp.
- [ ] 4.5 Unit tests: given a fixture contract, the generator
  produces a syntactically valid TypeScript file that compiles
  under `tsc --noEmit` and that, when loaded into the executor
  fakes, returns the expected output impulse on a sample input.

## Phase 5 — `vesselize-external-resolver` activity

- [ ] 5.1 New activity template
  `vesselize-external-resolver.json` in
  `repos/ias-executor-ts/src/templates/external-resolver-
  vesselization/`. Composes `forge-vessel-for-shape`'s 8 tasks
  plus the new `wire_external_call_pass_through` task per design
  §C (position 4 of 9).
- [ ] 5.2 Variables: `externalResolverContractId` (impulse id of
  the contract), inherits forge variables (`parentExecutionId`,
  `parentDepth`, `conceptDbEndpoint`, `deploymentWorkdir`).
- [ ] 5.3 `compose_vessel_spec` task config amended to pass the
  contract impulse through to the LLM prompt so the generated
  vesselSpec's `inputSchema`/`outputSchema` match the contract's
  inferred shapes.
- [ ] 5.4 Task 5 (`wire_discovery_registration`) `inputShapes`
  amended from `[vesselScaffold]` to `[vesselScaffoldWithProxy]`.
- [ ] 5.5 Tests using the executor fakes: contract impulse →
  vesselize dispatch → mock-deploy success → minted-vessel
  scaffold contains the generated proxy file.

## Phase 6 — Integration canary (gh-CLI)

- [ ] 6.1 Seed an operator-authored activity that runs
  `gh pr list --json number,title,state --repo
  metabob/activity-api` via `shell-exec`, against a real GitHub
  token mounted on the canary.
- [ ] 6.2 Run the activity ≥60 times against the canary so the
  trace store accumulates the sample size.
- [ ] 6.3 Dispatch `observe-external-resolver` with
  `call_kind=shell_exec`, `target_prefix=gh`. Verify
  `externalResolverContract` impulse emitted with
  `recommended_shape_name = "githubPrList"` and
  `vesselization_readiness.passes_*` all true.
- [ ] 6.4 Dispatch `vesselize-external-resolver` with the contract
  impulse. Verify the forge pipeline runs to
  `vesselVerified`.
- [ ] 6.5 Make a fresh call against `gh pr list` and observe the
  trace stream: `resolver_id` should now equal the minted
  vessel's resolver id, `resolver_tier = "deterministic"`,
  `signal_confidence_weight ∈ [0.3, 0.7]`.
- [ ] 6.6 Run a parallel call against a *different* external (e.g.
  `gh issue list`) that does NOT have a vesselized contract;
  verify it continues to route through `shell-exec` with no
  regression.

## Phase 7 — Acceptance gates

- [ ] 7.1 R1–R8 of `specs/external-resolver-vesselization/
  spec.md` all green.
- [ ] 7.2 Closure: `closure-audit --without=operator-shell`
  reports zero failures for the observe → vesselize pipeline
  across 3 consecutive runs.
- [ ] 7.3 Coexistence verified: at least one un-vesselized
  external continues to route through the generic resolver path
  with no behavior change (R6 acceptance).
- [ ] 7.4 Workbench `ExecutionHistoryPanel` displays the minted
  vessel's traces with the per-impulse
  `signal_confidence_weight ≤ 0.7`.
- [ ] 7.5 Document the canary outcome in
  `validation/results/2026-05-23-external-resolver-vesselization.md`
  (or follow the active report-archive convention).
