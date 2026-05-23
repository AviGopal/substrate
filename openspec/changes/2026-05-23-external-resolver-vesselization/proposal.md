# Proposal: External-Resolver Vesselization

## Why

The substrate calls external services — databases, HTTP APIs, MCP
servers, shell commands — through a small set of generic adapters:
`shell-exec`, `http-fetch`, the existing `external-validation`
resolver (`docs/guides/EXTERNAL_VALIDATION.md`), and a handful of
MCP-style call wrappers. Each adapter knows how to talk to many
backends; each backend is anonymous to the substrate. The adapter is
the only typed surface, and that surface is "an external thing of
unknown shape."

Every successful call leaves a trace with input impulse, output
impulse, cost, latency, and success/failure status. Across N
successful calls to the same external target, **the trace stream IS
the implicit contract for that target**: input-shape pattern,
output-shape pattern, error modes, performance distribution, cost
distribution. The substrate already learns this contract — it just
has nowhere to put it. The contract lives entirely in the trace
store, unindexed, untyped, unaddressable.

The foundation already anticipates this. From
`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` §292–334
("Vessel Discovery"):

> Vessels are NOT discovered through a registry. They are
> **introspected** at the point of use. … When MiniBob operates in
> a codebase, that codebase IS a vessel with its own resolvers …
> Vessels collaborate, not nest.

The same logic that turns a codebase's `package.json` into a vessel
turns N successful calls to a stable external endpoint into a vessel.
The contract is read out of traces rather than out of a manifest, but
the result is the same: a typed shape, a resolver, and a participant
in discovery.

`EXTERNAL_VALIDATION.md` is the partial-precedent on the resolver
side: one generic resolver fans out to five validation types and
13+ error categories. It works, and it stays. What is missing is the
*next* step: when calls to a particular external (e.g., `gh pr list`
on github.com, or `POST https://api.stripe.com/v1/charges`) become
frequent and stable, the substrate should mint a typed vessel for
that target. Subsequent calls route through the new vessel by shape;
the generic resolver remains as the bootstrap path for everything
else.

This is **ribosome-for-externals**. The ribosome already extracts new
activity templates from successful task chains; the same machinery,
repointed at *calls leaving the substrate*, extracts new vessels
from successful external call patterns. The architectural parallel
to `2026-05-23-llm-to-deterministic-distillation` is direct: both
turn fat-resolver patterns into thin specialized ones. That spec
targets LLM-of-too-much-capability; this one targets
external-service-of-too-generic-interface. The substrate's vessel
population grows in response to actual external-call usage rather
than to operator pre-declaration.

This is the first of a three-spec series:

- **This spec** — `external-resolver-vesselization` — mint vessels
  for external services the substrate has been calling.
- **Sibling, out of scope** — `external-observer-vesselization` —
  mint vessels for external services the substrate is *observed by*
  (webhooks, polling consumers, push-subscribers).
- **Sibling, out of scope** — `external-trust-weighting` — refine the
  `signal_confidence_weight` rules for vessels minted from external
  observation (per-call corroboration, drift detection, decay).

## Self-application

External-resolver vesselization is itself an activity catalog plus a
resolver set; it MUST be subject to the same conditions as every
other learning mechanism:

- **Foundation alignment** — the extraction is a ribosome operation
  over the existing trace store. No new primitive. Shape inference,
  template composition, and forge dispatch are all expressed in
  the four-primitive model.
- **Closure** — the entire pipeline (`observe-external-resolver`
  scanning, `vesselize-external-resolver` dispatch, forge vessel
  spawning the new vessel) is substrate-resident. Operator does
  not author the minted vessels.
  `closure-audit --without=operator-shell` covers the pipeline.
- **Confidence weighting** — impulses emitted by a vesselized
  external resolver carry `signal_confidence_weight ≤ 0.7` (the
  external-source ceiling per the trust-weighting sibling default),
  scaled by observed shape stability and success rate. External
  evidence is corroborable but not authoritative; the cap reflects
  that the external service is not a substrate participant.
- **Thompson-managed promotion** — the decision to vesselize is
  itself sampled. Cost-weighted Thompson selects when to invest
  the forge cost against the expected savings of typed routing
  (faster recommend, per-shape α/β, per-vessel deprecation paths).
  Vesselization is not automatic; it is *learned*.
- **Vesselization is itself vesselizable** — the
  `vesselize-external-resolver` activity is itself an activity. Its
  α/β accrue. If the substrate observes that a particular *kind* of
  external is consistently vesselized via a particular composition,
  the ribosome extracts that as a higher-order template. The
  recursion bottoms out at the forge primitive itself.
- **Reversibility** — a vesselized external whose `shape_stability`
  collapses (external service changed its API) triggers
  re-vesselization or deprecation through the standard ribosome
  flow. No new retirement path needed.

## What Changes

1. **`observe-external-resolver`** — new activity template. Reads
   `activity_execution_traces` filtered by `(call_kind, target)`,
   infers `input_shape` / `output_shape` from N successful calls,
   emits `externalResolverContract` impulse. Sample-size, shape-
   stability, and success-rate floors gate the vesselization
   recommendation field.
2. **`externalResolverContract` shape** — new shape advertised by the
   activity-api (as the trace owner) and consumed by the
   vesselization activity. Carries call-kind, target, sample size,
   inferred input/output schemas, operational characteristics
   (latency, cost, failure modes), and a vesselization-readiness
   sub-record.
3. **`wire-external-call-pass-through`** — new substrate-resident
   forge task type. Consumes an `externalResolverContract` impulse;
   generates the resolver implementation for the new vessel: a thin
   proxy that receives impulses of the inferred input shape,
   transforms to the external call format, invokes the original
   generic resolver (`shell-exec` / `http-fetch` / `external-
   validation`), transforms the response back to the inferred output
   shape, and returns it as an impulse with
   `signal_confidence_weight` populated from §E (design).
4. **`vesselize-external-resolver`** — new activity template that
   composes the existing eight-task `forge-vessel-for-shape` pipeline
   from `repos/ias-executor-ts/src/templates/forge/` with the new
   `wire-external-call-pass-through` task inserted between
   `scaffold_vessel_skeleton` and `wire_discovery_registration`. The
   forged vessel owns the derived shape and proxies calls to the
   original generic resolver.
5. **Trace filter primitive** — minor extension to the activity-api
   trace-list query path to filter by `tasks[].resolver_id` and a
   target-extractor (URL prefix, command prefix, MCP method). The
   per-task `resolver_id` field already exists; what is added is the
   query path that groups traces by `(resolver_id, target)` for the
   observe activity to scan. See design §A.
6. **Non-breaking coexistence with `external-validation`** — the
   generic resolver remains as the bootstrap path for first-N calls
   to an external. Vesselization is the lift-out path, not a
   replacement. After vesselization, calls for the matched shape
   route through the new vessel by shape; unmatched calls continue
   through the generic resolver. See design §F.

## Success criteria

1. **Trace-filter primitive operational**: the activity-api trace
   query API exposes `(call_kind, target)` filtering against
   per-task `resolver_id` + extracted target field. Verified by a
   contract test in the activity-api test suite.
2. **`observe-external-resolver` emits contracts**: scanning the
   trace store produces `externalResolverContract` impulses for at
   least one well-known external call pattern (suggested canary:
   `gh pr list` via `shell-exec`). The emitted contract carries the
   inferred shapes, sample size, and vesselization-readiness flags.
3. **`vesselize-external-resolver` mints a vessel**: dispatching the
   activity with a positive-readiness contract produces a new
   substrate-resident vessel that registers with discovery, advertises
   the derived shape, and proxies calls through the original generic
   resolver. End-to-end on the gh-CLI canary.
4. **Confidence weighting honored**: impulses returned by the
   minted vessel carry `signal_confidence_weight ≤ 0.7`, computed
   per the §E formula. Verified by a workbench assertion against
   the live canary.
5. **Coexistence preserved**: a second external (one without enough
   trace history to vesselize) continues to be served by
   `external-validation` / `shell-exec` / `http-fetch` with no
   regression. Verified by a parallel test path.
6. **Closure**: `closure-audit --without=operator-shell` reports
   zero failures for the observe → vesselize → mint pipeline.

## Capabilities

### New Capabilities

- `external-resolver-vesselization` — observe-external-resolver
  activity, externalResolverContract shape, wire-external-call-
  pass-through forge task, vesselize-external-resolver activity
  composing the existing forge pipeline. Spec:
  `specs/external-resolver-vesselization/spec.md`.

### Modified Capabilities

- `substrate-forge-vessel` gains the
  `wire-external-call-pass-through` forge task in its forge resolver
  set. The eight-task `forge-vessel-for-shape` template is unchanged
  in structure; the new resolver is composable into a nine-task
  variant via `vesselize-external-resolver`.
- `metabob-activity-api` execution-traces query path gains the
  `(call_kind, target)` filter parameters.
- IAL Phase 27 acceleration siblings gain the
  external-resolver-vesselization mechanism alongside
  llm-to-deterministic-distillation as a complementary cost-and-
  typing-reduction loop.

## Dependencies

- `2026-05-23-substrate-forge-vessel` (committed) — provides the
  `forge-vessel-for-shape` template and the
  `VesselForgeHost`-registered resolvers (`scaffold_vessel_skeleton`,
  `wire_discovery_registration`, `wire_auth_blueprint`,
  `docker_build_push`, `helmfile_sync`,
  `verify_three_invariants`). This change adds one new resolver
  (`wire_external_call_pass_through`) to that host's registration
  set.
- `2026-05-23-signal-confidence-weighting` (committed) — the
  `signal_confidence_weight` field on traces and the multiplication
  in `applyOutcomeToPosteriors` are the surface this spec writes
  into.
- IAL Phase 22 (Autonomous Vessel Forge) — `forge-vessel-for-shape`
  template already committed in `repos/ias-executor-ts`.
- `repos/metabob-activity-api/src/routes/execution-traces.ts` — the
  per-task `resolver_id` and `resolver_tier` fields already exist
  in the trace schema (migration 086). What this spec adds is a
  query-path filter, not a schema change.

## Out of scope

- **External-observer vesselization** — minting vessels for
  external services that *call into* the substrate (webhooks,
  polling subscribers). Sibling spec
  `external-observer-vesselization`.
- **Trust-weighting refinements** — per-call corroboration, drift
  detection, decay rules for `signal_confidence_weight` on
  externally-derived impulses. Sibling spec
  `external-trust-weighting`. This spec ships only the default
  ceiling (0.7) and the base formula.
- **Specific external-service vessels** — no opinionated catalog
  of which externals to vesselize. The substrate decides via
  observation. The gh-CLI canary in §6 of acceptance is the
  proof-of-mechanism, not a default-shipped vessel.
- **OpenAPI / Swagger-driven scaffolding** — out of scope by
  design (see design §H Q1). The empirical shape from traces is
  the canonical contract; documented schemas often diverge.
- **External-service authentication management** — the minted
  vessel proxies through the original generic resolver and inherits
  its credential-resolution path. Per-vessel credential rotation
  for externals is a separate concern.
- **Promotion-readiness Thompson tuning** — the floors (sample size
  ≥50, shape stability ≥0.8, success rate ≥0.9) are operator-set
  defaults. Cost-weighted-posteriors learning of these thresholds
  is deferred.
