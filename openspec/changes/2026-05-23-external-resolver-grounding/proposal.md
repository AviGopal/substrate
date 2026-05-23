# 2026-05-23 — External-Resolver Grounding (development-vessel)

## Motivation

The substrate has no documented or activity-driven path for absorbing
an external HTTP resolver (a third-party API, an MCP server, a CLI
tool) as a vessel when no prior traces exist against that resolver.
Every existing vessel in `repos/` was hand-authored against
`docs/architecture/TYPESCRIPT_VESSEL_TEMPLATE.md`. When a failure-mode
harness gap reports "no vessel provides shape X" and the substrate
has never called any candidate that could provide it, the only
remediation today is operator intervention.

This change makes that onboarding a measured pipeline of activities,
so the substrate can extend its own resolver surface the same way it
closes failure-mode gaps. It dogfoods the impulse/activity model on
the meta-problem of growing the system.

The first concrete target is **Perplexity Sonar**, chosen because:
- Small, well-documented contract (single POST endpoint, JSON in/out).
- Fills a real capability gap (fresh external web grounding) — see the
  Perplexity comparison in user conversation 2026-05-23.
- Narrow enough that probe-driven shape inference is tractable.

## Relationship to the discovery horizon

This change operates at the **discovery horizon** as defined by the
four-primitive model applied recursively (foundation §812–823). Traces
produced by every activity in this change carry the horizon tag
`intent: external_resolver_discovery` plus the activity-specific
sub-intent (e.g. `external_resolver_probing`,
`external_resolver_scaffolding`). The tag set is additive — see
discovery-horizon requirement in each spec below.

This change is the **probe-driven sibling** of
`2026-05-23-external-resolver-vesselization`, which is the
**trace-driven sibling**. Both produce vessels for external
resolvers; they differ only in the source of the input impulse:

| | Input impulse source | Applies when |
|---|---|---|
| `external-resolver-grounding` (this change) | Operator-supplied `resolverCandidate` or `unknown-shape-report` escalation | Substrate has no prior traces against the candidate |
| `external-resolver-vesselization` (sibling) | `observe-external-resolver` scan of existing traces | Substrate has ≥ 50 successful traces matching a `(call_kind, target)` group |

At the discovery horizon both are recall (i → t → o, foundation §30):
input impulse → activity → vessel-producing trace. Thompson sampling
selects between them per gap based on observed posteriors at the
discovery horizon. Neither is privileged; the substrate learns which
performs better for which gap kind.

The two siblings share the trace store and the discovery-horizon
intent tag, so the ribosome (operating with a discovery-horizon
filter) can extract higher-order discovery templates from successful
sequences of either sibling without distinguishing them.

## Proposal

Add five seed templates to development-vessel that compose into an
end-to-end onboarding pipeline:

1. **`probe-external-resolver`** — given a `resolverCandidate` impulse
   (URL + auth + optional OpenAPI/MCP descriptor), send a typed battery
   of probe requests, record traces, emit a `probeReport` impulse with
   inferred input/output shapes, error modes, latency, cost-per-call.
2. **`synthesize-vessel-scaffold`** — given a `probeReport`, dispatch
   to a vessel advertising `llm_completion` to draft source files
   matching `TYPESCRIPT_VESSEL_TEMPLATE.md`. Writes to
   `repos/<proposed-name>-vessel/` as a proposal, not a commit. Emits
   `vesselScaffold` impulse.
3. **`compile-and-smoke-test`** — given a `vesselScaffold`, run
   `bun install && bun run lint && bun test`; invoke the scaffold's
   `/v2/impulses/resolve` endpoint with N synthetic requests; emit
   `scaffoldHealth` (pass/fail + per-probe latency + per-probe shape
   conformance vs. the probeReport contract).
4. **`register-provisional-vessel`** — given a healthy scaffold,
   register with discovery-vessel under a `provisional: true` flag.
   Emit `provisionalRegistration` impulse with the registered
   vessel-id and shape list.
5. **`promote-vessel`** — read recent traces for a provisional vessel;
   when ≥ K traces succeed with shape contract intact, flip
   `provisional → stable` via discovery-vessel; emit
   `vesselPromotion` impulse. Threshold K is a config value, default
   20.

Plus one schema change:

- **discovery-vessel: add `provisional: boolean` (default false)** to
  the registration payload and registry record. When `provisional`,
  the binding-layer's `discover-by-shapes candidates_with_scores`
  applies a configurable weight penalty (default 0.5×) so untrusted
  vessels are sampled less aggressively until promoted.

## Out of Scope

- **Discovery of candidates** (`scan-external-capability`,
  `scan-mcp-registry`). This change assumes the operator hands the
  pipeline a candidate; auto-discovery is a follow-on.
- **Drift detection** (`detect-shape-drift`). The promotion criterion
  catches initial contract instability; ongoing drift is a separate
  loop.
- **Vessel-level deprecation** (`detect-stale-vessel`,
  `deprecate-vessel`). Template-level analogues exist
  (`prune-activity`); vessel-level twins are deferred.
- **Recipe extraction across vessels** — the existing ribosome handles
  single-vessel patterns; multi-vessel recipe promotion is deferred.
- **Cron / scheduler.** Pipeline runs on operator demand via
  `bun run cli execute probe-external-resolver --var candidate=…`.

## Non-Goals

This proposal does not claim that the substrate can autonomously
discover and onboard arbitrary external resolvers. It builds the
*wrapping* pipeline. The discovery edge — finding candidates without
being handed one — is a separate change.

## Dependencies

- **conversation-vessel** must advertise `llm_completion` shape
  (closed in `2026-05-22-failure-mode-autonomous-loop` DEV-1).
- **discovery-vessel** registration schema accepts an additional
  optional `provisional` field. Backward compatible — missing field
  defaults to `false`.
- **development-vessel** seed-template uploader (`bun run cli
  seed-templates`) used to install the five templates.
- A vessel that advertises an HTTP-call resolver shape
  (e.g. `http_request`). If none exists, dev-vessel adds a minimal
  one alongside the seed templates.

## Acceptance

The change is complete when:

1. All five templates exist in
   `repos/development-vessel/src/seed/` and are exported from
   `src/seed/index.ts`.
2. `bun run lint` and `bun test` pass in development-vessel; each
   template has a per-template unit test validating its task graph
   (input/output shape contract).
3. discovery-vessel schema migration accepting `provisional: boolean`
   ships and is verified live (`curl POST /register` with the field
   returns 200; `GET /registry/stats` reports the count).
4. `bun run cli seed-templates` uploads all five templates to
   activity-api without 403.
5. End-to-end Perplexity-Sonar onboarding: operator invokes
   `bun run cli execute probe-external-resolver
   --var candidate_url=https://api.perplexity.ai/chat/completions
   --var auth_secret=$PPLX_API_KEY`. The pipeline produces, in order:
   a `probeReport`, a scaffold at `repos/perplexity-vessel/`, a
   passing `scaffoldHealth`, a `provisionalRegistration`, and after
   ≥ 20 successful traces a `vesselPromotion`.
6. The newly-promoted vessel resolves a goal that requires fresh web
   search (e.g. "summarise current state of X"). MiniBob picks it via
   normal `discover-by-shapes` selection — no special-casing.
7. `validation/scripts/progression-driver.ts` cycle report counts the
   new vessel under `vessels_authored_by_horizon.discovery` (the
   discovery-horizon trace-tag count), with the per-activity
   sub-intent recorded in trace metadata so the count can be split
   between the probe-driven and trace-driven siblings without
   privileging either.
