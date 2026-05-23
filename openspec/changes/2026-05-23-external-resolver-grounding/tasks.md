# Tasks — external-resolver-grounding

Per dev-vessel discipline: VERIFY → DEBUG → SPEC (this doc) → DEV.
Each DEV-N step ends with
`cd repos/development-vessel && bun run lint && bun test`.

## DEV-1: discovery-vessel `provisional` field

- [ ] Add `provisional`, `provisional_since`, `promotion_criterion`
      to the registration payload schema in
      `repos/discovery-vessel/src/types.ts`.
- [ ] Update `src/registry.ts` to persist and return the new fields.
- [ ] Update `discover-by-shapes candidates_with_scores` to apply the
      provisional down-weight (config `PROVISIONAL_WEIGHT`, default 0.5).
- [ ] Migration note: no DB migration; in-memory registry. Document in
      the discovery-vessel CHANGELOG.
- [ ] Unit tests: register with provisional=true returns 200; query
      returns the field; scoring down-weight verified.
- [ ] Bump discovery-vessel minor version.

## DEV-2: dev-vessel `http_request` resolver (if missing)

- [ ] Audit `repos/development-vessel/src/resolvers/` for an
      HTTP-call resolver. If absent, add one with timeout, retry, and
      cost-tracking.
- [ ] Per-resolver test covering 200/4xx/5xx/timeout cases.
- [ ] Register as shape `http_request` in dev-vessel's resolver table.

## DEV-3: probe-external-resolver seed template

- [ ] Create
      `repos/development-vessel/src/seed/probe-external-resolver.ts`.
- [ ] Wire into `src/seed/index.ts`.
- [ ] Per-template unit test validating the 5-task graph.
- [ ] Author the `probeReport` shape definition (input/output schema).

## DEV-4: synthesize-vessel-scaffold seed template

- [ ] Create
      `repos/development-vessel/src/seed/synthesize-vessel-scaffold.ts`.
- [ ] LLM prompt template living in
      `repos/development-vessel/src/seed/prompts/synthesize-vessel.md`
      (operator-readable, not inlined in TS).
- [ ] Per-template unit test (mock conversation-vessel).
- [ ] Author `vesselScaffold` shape.

## DEV-5: compile-and-smoke-test seed template

- [ ] Create
      `repos/development-vessel/src/seed/compile-and-smoke-test.ts`.
- [ ] Per-template unit test (mock `shell_exec` + `http_request`).
- [ ] Author `scaffoldHealth` shape.
- [ ] Sandbox concern: smoke-test boots the scaffold on an ephemeral
      port. Document the port-allocation strategy in the template's
      task config.

## DEV-6: register-provisional-vessel seed template

- [ ] Create
      `repos/development-vessel/src/seed/register-provisional-vessel.ts`.
- [ ] Per-template unit test (mock discovery-vessel HTTP).
- [ ] Author `provisionalRegistration` shape.

## DEV-7: promote-vessel seed template

- [ ] Create `repos/development-vessel/src/seed/promote-vessel.ts`.
- [ ] Per-template unit test.
- [ ] Author `vesselPromotion` shape.
- [ ] Decide threshold default with operator: `min_traces=20`,
      `min_success_rate=0.7`, `max_shape_drift=0.1` (placeholders —
      refine after DEV-9).

## DEV-8: seed-template upload + smoke

- [ ] `bun run cli seed-templates` uploads all five without 403.
- [ ] `curl GET /v2/activities/templates/<id>` returns each with
      correct task graph and tags.
- [ ] Note any FTS / id-wrapping issues (pre-existing canary bugs).

## DEV-9: Perplexity Sonar end-to-end onboarding

- [ ] Operator stages `~/.metabob/perplexity-secret` with a real API
      key.
- [ ] Invoke
      `bun run cli execute probe-external-resolver
       --var candidate_url=https://api.perplexity.ai/chat/completions
       --var candidate_name=perplexity
       --var auth_secret_path=~/.metabob/perplexity-secret`.
- [ ] Capture each emitted impulse to
      `validation/onboarding-runs/2026-05-23-perplexity/`:
      `probeReport.json`, `vesselScaffold.json`, `scaffoldHealth.json`,
      `provisionalRegistration.json`.
- [ ] Run a MiniBob goal that requires fresh web search; confirm the
      provisional perplexity-vessel is selected (verify in trace).
- [ ] After ≥ 20 successful traces, invoke
      `bun run cli execute promote-vessel`; confirm
      `vesselPromotion.json` and discovery-vessel registry shows
      `provisional: false`.

## DEV-10: progression-driver integration

- [ ] Update
      `validation/scripts/progression-driver.ts` to count vessels
      with `authored_by: external_resolver_grounding` in
      `vessels_authored_by`.
- [ ] Add to cycle-N.json schema.
- [ ] Document in
      `validation/failure-modes/PROGRESSION.md`.

## DEV-11: documentation

- [ ] Create
      `docs/guides/EXTERNAL_RESOLVER_ONBOARDING.md` with the
      Perplexity walk-through as the worked example.
- [ ] Cross-link from
      `docs/architecture/TYPESCRIPT_VESSEL_TEMPLATE.md` (manual path)
      to the new guide (autonomous path).
- [ ] Add a `probeReport` / `vesselScaffold` / `scaffoldHealth` /
      `provisionalRegistration` / `vesselPromotion` entry to
      `docs/shapes/README.md`.

## Stop-doing-this signal

This change is complete when DEV-9 produces a stable Perplexity vessel
and a MiniBob goal genuinely uses it without operator intervention.
The change is archived when the same pipeline successfully onboards a
**second** external resolver (different protocol shape — e.g. an MCP
server) with **no code edits**, only operator-supplied candidate
inputs. That second onboarding is the falsifiability test for "did we
build a pipeline or did we build a Perplexity wrapper?".
