# Tasks — Tier-Restricted Bandit

## Status (2026-06-04 application)

- [x] D.1 — `src/services/tier-classifier.ts` applied (82 lines).
- [x] D.2 — `src/services/tier-classifier.test.ts` applied; 10/10 pass.
- [ ] D.3-D.5 — **Integration deferred.** Patch context for
  `src/routes/activities.ts` (semanticMatcher import) and
  `src/lib/posterior-update.ts` (`TraceForPosterior.tasks[*]` extension +
  write-side skip branch) drifted against current files; the agent had
  inspected a different version of `activities.ts` (which is now 409KB
  with reorganized imports). The classifier module is in place and
  testable; downstream wiring needs a fresh diff against the current
  selector path. Follow-up openspec change should pin the exact line
  numbers from a recent commit.

## SPEC

- [ ] S.1 — Verify substrate anchor concepts cited in `proposal.md` are
  still extant (no supersession marker):
  - `concept_SDerP4GcuhGm` (tier_restricted_bandit_skipping_deterministic)
  - `concept_TbN0eSf7U_hM` (parent)
  - `concept_RZGwUvuKDHSl` (activity-api as Thompson learner)
  - `concept_y4wjxfQAMSBU` (resolvers live where data lives)
  - `concept_7mzv7SQN_7JB` (no-new-primitive discipline)
- [ ] S.2 — Confirm `concept_7mzv7SQN_7JB` discipline holds: this change
  adds no new primitive, no new tier, no new scope, no new resolver type.
- [ ] S.3 — Cross-reference with `2026-05-23-cost-weighted-posteriors` and
  `2026-05-17-state-space-signature-thompson-keying` to ensure the
  tier-restricted branch composes (not collides) with cost weighting and
  signature keying. Specifically: tier-uniform path must still feed the
  state-space-signature write key when one is provided, OR explicitly skip
  both writes — pick one and document.

## DEV

- [ ] D.1 — Add `src/services/tier-classifier.ts` exporting
  `classifyTemplateTiers(template)` and the deterministic-resolver set
  (sourced from `activities.ts:3708-3723`).
- [ ] D.2 — Add `src/services/tier-classifier.test.ts` covering all
  classification branches incl. `unknown` and `missing tasks`.
- [ ] D.3 — Wire the selection-side branch into the `/v2/activities/recommend`
  hot loop in `src/routes/activities.ts` around the `betaSample` call
  (currently line 6191). Stamp `tier_class` and `sample_source` into
  `selection_metadata`.
- [ ] D.4 — Wire the write-side branch into
  `applyOutcomeToPosteriors` in `src/lib/posterior-update.ts`. Extend
  `TraceForPosterior.tasks[*]` with optional `resolver_tier`. Add the
  `skipped_reason: 'all_deterministic'` field to `UpdateSummary`.
- [ ] D.5 — Add tests in `src/lib/posterior-update.test.ts` (or
  `src/lib/posterior-update.tier.test.ts`) covering: all-det skip,
  mixed write, all-stochastic write, missing-tier-field fallback.
- [ ] D.6 — Run `bun run typecheck` and `bun run lint` in
  `repos/metabob-activity-api`. Resolve any shape-dispatch-check
  failures (none expected — this change adds no new impulse shape).
- [ ] D.7 — `bun test` green.

## DEPLOY

- [ ] DP.1 — Bump `repos/metabob-activity-api/package.json` patch version.
- [ ] DP.2 — Commit on `dev` branch (fast-forward only per `CLAUDE.md`
  "Branch hygiene").
- [ ] DP.3 — Push to `dev`; canary deploy via existing
  `repos/deployment/.github/workflows/deploy-canary.yml`.
- [ ] DP.4 — Verify pod healthy on canary; `kubectl logs` shows no
  classifier-related warnings.

## VERIFY

- [ ] V.1 — Inspect a recent recommendation trace via
  `mcp__metabob__get_problems` or direct SurrealDB query:
  confirm `selection_metadata.sample_source` includes `'tier_uniform'`
  for at least one all-deterministic template within 24h of deploy.
- [ ] V.2 — Re-run stratified-harness
  (`validation/scripts/stratified-harness.ts`) two weeks post-deploy.
  Acceptance: MRR non-decreasing vs. pre-deploy baseline
  (`validation/results/2026-05-18-reuse-report.json` baseline MRR=0.2361
  unless superseded by a more-recent baseline). Report stored under
  `findings/post-deploy-mrr-YYYY-MM-DD.json`.
- [ ] V.3 — Concept-db percolation: emit a `memoryNote_write` (or, until
  shipped, write under operator-side memory with `pending_sync: true` per
  `CLAUDE.md` "Memory" section) summarizing the observed rate gain.
- [ ] V.4 — Archive change via `openspec-archive-change` skill once V.1-V.3
  green.
