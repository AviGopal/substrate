# Tasks — substrate-self-replacement-pipeline

Per dev-vessel discipline: VERIFY → DEBUG → SPEC (this doc) → DEV.
Each DEV-N step ends with
`cd repos/development-vessel && bun run lint && bun test`.

## DEV-1: discovery-vessel atomic-swap support

- [ ] Add etag generation on `/vessels/:id` GET responses and etag
      validation on PATCH.
- [ ] Reject PATCH with 409 Conflict on etag mismatch.
- [ ] Add `state: "active" | "provisional" | "archived"` field;
      archived vessels return registration data but are excluded
      from shape-resolution queries.
- [ ] Unit tests: concurrent PATCH attempts; archived-state
      exclusion.

## DEV-2: vessel-purity checklist resolvers

- [ ] Add `vesselPurityReport` shape definition to dev-vessel
      `src/types/shapes.ts`.
- [ ] Implement deterministic checks 1-7 of design §B as composable
      resolvers in `development-vessel/src/resolvers/purity/`.
- [ ] Per-resolver unit tests covering pass + each known failure
      mode.
- [ ] Self-audit: run `audit-vessel-purity` against
      development-vessel itself; expect zero high-severity gaps.

## DEV-3: audit-vessel-purity seed template

- [ ] Create
      `repos/development-vessel/src/seed/audit-vessel-purity.ts`.
- [ ] Wire into `src/seed/index.ts`.
- [ ] Per-template unit test validating the 10-task graph.
- [ ] Smoke audit against `discovery-vessel`, `identity-vessel`,
      `metabob-activity-api`. Compare gap list to the audit findings
      in the prior audit conversation (CLAUDE.md acknowledged gaps);
      expect alignment.

## DEV-4: draft-replacement-vessel seed template

- [ ] Create
      `repos/development-vessel/src/seed/draft-replacement-vessel.ts`.
- [ ] Author the prompt at
      `repos/development-vessel/src/seed/prompts/draft-replacement-vessel.md`
      with naming/org constraints from design §F encoded as
      hard requirements.
- [ ] Per-template unit test (mock conversation-vessel; verify
      naming check rejects forbidden substrings).
- [ ] Add `replacementScaffold` shape definition.
- [ ] Confirm forge dispatch composes cleanly (read existing
      `forge-vessel-for-shape` template; ensure
      `derive-contract` output matches the forge's input shape).

## DEV-5: shadow-validate-replacement seed template

- [ ] Create
      `repos/development-vessel/src/seed/shadow-validate-replacement.ts`.
- [ ] Add `shadowDivergence` and `shadowReport` shape definitions.
- [ ] Add `dispatchBoth` mode to discovery-vessel's resolver
      routing (a registered provisional vessel can be tagged
      `shadow_of: <vessel_id>` so discovery dispatches the request
      to both; only the primary's response returns to the caller,
      the secondary's response is recorded).
- [ ] Per-template unit test (mock both vessels, verify divergence
      computation).
- [ ] Sandbox concern: shadow-tap install requires discovery-vessel
      config update; document the rollback path if shadow causes
      production issues.

## DEV-6: promote-replacement seed template

- [ ] Create
      `repos/development-vessel/src/seed/promote-replacement.ts`.
- [ ] Add `replacementPromotion` shape definition.
- [ ] Wire `human_resolver` for the operator-approval step;
      default `automated_mode=false`.
- [ ] Per-template unit test (mock discovery; verify atomic-swap
      retry on etag conflict).

## DEV-7: archive-vessel seed template

- [ ] Create
      `repos/development-vessel/src/seed/archive-vessel.ts`.
- [ ] Add `vesselArchive` shape definition.
- [ ] Per-template unit test (mock `shell_exec` and `fs_write`;
      verify archive path format and manifest updates).
- [ ] Document the recovery path if archive fails partway (e.g.,
      source moved but registry not yet flipped).

## DEV-8: seed-template upload + smoke

- [ ] `bun run cli seed-templates` uploads all five plus their
      shape advertisements without 403.
- [ ] `curl GET /v2/activities/templates/<id>` returns each with
      correct task graph and tags.
- [ ] Tag verification: each template's traces carry
      `intent:substrate_maintenance` plus the activity-specific
      sub-intent.

## DEV-9: C.1 canary — tool-vessel decomposition

The first end-to-end pipeline run.

- [ ] Stage minibob's tool source under inspection: confirm
      `repos/minibob/src/tools.ts` and related files implement
      `bash`, `read`, `write`, `edit`, `git` as built-ins.
- [ ] Run `audit-vessel-purity` against minibob. Expect a report
      flagging built-in tools as a `domain-local shapes` violation
      with `replacement_scope: extract_to_vessels`.
- [ ] For each tool family — `shell-vessel` (covers `bash`),
      `filesystem-vessel` (covers `read`, `write`), `editor-vessel`
      (covers `edit`), `git-vessel` (covers `git`) — invoke the
      pipeline end-to-end:
  - [ ] `draft-replacement-vessel`
  - [ ] `shadow-validate-replacement` (oracle mode; ≥ 200 traces;
        divergence ≤ 0.01)
  - [ ] `promote-replacement` (operator approves)
- [ ] After all four are promoted, edit minibob to remove the
      built-in tool implementations; verify minibob's tests still
      pass with tools routed through discovery.
- [ ] Run `archive-vessel` against `repos/minibob/src/tools.ts`
      (file-level archive, not vessel-level — the artifact is a
      subset of minibob, not minibob itself).
- [ ] Confirm `closure-audit --without=operator-shell` passes for
      the audit → draft → shadow stages; documents one expected
      failure at promote-replacement (the operator-approval gate).

## DEV-10: validation harness integration

- [ ] Add a "self-replacement cycle" entry to
      `validation/failure-modes/scenarios/` capturing the pipeline
      contract.
- [ ] Update `validation/scripts/progression-driver.ts` to count
      vessels produced via this pipeline under
      `vessels_authored_by_horizon.substrate_maintenance` with
      sub-intent `internal` (sibling to `external_resolver_vesselization`'s
      `external` sub-intent).
- [ ] Document in
      `validation/failure-modes/PROGRESSION.md`.

## DEV-11: documentation

- [ ] Create
      `docs/guides/SUBSTRATE_SELF_REPLACEMENT.md` with the C.1
      walk-through as the worked example.
- [ ] Cross-link from
      `docs/architecture/TYPESCRIPT_VESSEL_TEMPLATE.md` (manual
      authoring) and
      `docs/guides/EXTERNAL_RESOLVER_ONBOARDING.md` (when it lands;
      the external sibling).
- [ ] Add shape entries to `docs/shapes/README.md` for
      `vesselPurityReport`, `replacementScaffold`,
      `shadowDivergence`, `shadowReport`, `replacementPromotion`,
      `vesselArchive`.
- [ ] Note in `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`'s
      foundation-citing materials (NOT modifying the foundation
      itself) that internal-resolver replacement is the
      counterpart to external-resolver vesselization at the same
      substrate-maintenance horizon.

## Stop-doing-this signal

This change is complete when DEV-9 succeeds end-to-end — minibob's
tool built-ins are replaced by four discovery-resolved vessels, the
old source is archived, and minibob's test suite passes with the
new routing.

The change is archived when the pipeline successfully replaces a
**second** load-bearing component without code edits beyond the
canary application — proving the pipeline is general, not a
minibob-tool-specific tool. C.2 (activity-vessel) is the natural
candidate for that second run, but is a separate openspec change.

## Continual-operation deferred to Phase F

The continual-audit loop (Phase F in the audit plan: periodic
`audit-vessel-purity` against all Tier 1+2 vessels with
auto-drafting of replacements crossing severity thresholds) is
explicitly deferred. This change ships the pipeline machinery and
one canary; the cron/scheduler that runs the pipeline continually
is a follow-on.
