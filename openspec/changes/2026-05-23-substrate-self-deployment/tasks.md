# Tasks: Substrate Self-Deployment

## Phase 1 — Git identity and SSH key

- [ ] 1.1 Extend `seed-identity.ts` to mint a substrate git identity
  + SSH keypair at substrate boot. Identity: `metabob-substrate-bot <noreply@metabob.com>`.
- [ ] 1.2 Public key written to
  `/etc/substrate/git/substrate-bot.pub` and registered with the
  remote repo's authorized keys (operator-managed; configured at
  bootstrap).
- [ ] 1.3 Private key stored in identity-vessel's secret store with
  resolver access scoped to development-vessel.
- [ ] 1.4 Identity rotation: a `rotate-substrate-git-identity` activity
  re-mints; operator-approval-required per §27.3.c.1.

## Phase 2 — Git resolver shapes

- [ ] 2.1 Advertise `gitClone`, `gitCommit`, `gitPush`, `gitOpenPR`,
  `gitMergePR`, `gitRead` shapes on development-vessel.
- [ ] 2.2 Implementation: each resolver shells out to `git` via
  `local-tools-vessel` `commandResult` resolver with substrate-bot
  identity scoped via `GIT_SSH_COMMAND`.
- [ ] 2.3 `gitOpenPR` and `gitMergePR` use the GitHub CLI (`gh`) when
  remote is GitHub. For non-GitHub remotes, the implementation
  delegates to the appropriate provider client.

## Phase 3 — PR-authoring activity

- [ ] 3.1 New activity template `author-pr`. Input:
  `candidateChangeSet` impulse. Output: `prAuthored` impulse with
  `pr_url`, `pr_id`, `branch_name`.
- [ ] 3.2 Implementation:
  - `gitClone` (or fetch) the latest dev branch state.
  - Apply the candidate change to a new branch
    `substrate/<timestamp>-<short_id>`.
  - `gitCommit` with frontmatter
    `authored_by: substrate-self-deployment`
    and message referencing the source `candidateChangeSet`.
  - `gitPush`.
  - `gitOpenPR` with body describing the change's provenance trace
    ids and expected impact.
- [ ] 3.3 Source `candidateChangeSet` impulses come from:
  - `propose-spec` activity (per §27.3.j.6).
  - `distillation-promotion` activity (per distillation sibling).
  - Other future ribosome extractors.

## Phase 4 — Merge gate

- [ ] 4.1 `gitMergePR` resolver verifies:
  - PR exists.
  - PR has a recent `mergeVerdict` impulse with `verdict: "pass"`
    referenced in the request body's `verdict_ref` field.
  - The verdict's trace timestamp is within 1h.
- [ ] 4.2 Missing or expired verdict → 403 with
  `verifier_negative.context.reason = "merge_verdict_missing_or_expired"`.
- [ ] 4.3 Negative verdict → 403 with
  `verifier_negative.context.reason = "merge_verdict_negative"`.
- [ ] 4.4 On success, `gitMergePR` performs the merge and emits
  `prMerged` impulse with `merge_commit_sha`.

## Phase 5 — Post-merge self-restart

- [ ] 5.1 A lifecycle subscriber listens for `prMerged` impulses on
  the dev branch. On detection, dispatches `restart-vessel` activity
  (§27.3.j.5) for the affected substrate units.
- [ ] 5.2 Affected-vessel detection: derived from the merged PR's
  file diff. Files under `repos/<vessel>/` trigger that vessel's
  restart; files under `scripts/substrate/units/` trigger systemd
  daemon-reload; markdown-only changes require no restart.
- [ ] 5.3 Restart sequence: snapshot pre-restart state → restart
  vessel → 30s health check → if healthy, emit
  `selfDeploymentSucceeded` impulse; if not, dispatch
  `revert-self-deployed-change` (Phase 6).

## Phase 6 — Rollback path

- [ ] 6.1 New activity `revert-self-deployed-change`. Input:
  recent self-deployed merge commit sha. Output: `prAuthored`
  for a revert PR.
- [ ] 6.2 Pre-rollback fork: `substrate-forge-vessel` spawns a fork
  with the revert applied; 30min evaluation; if successful, proceed
  with rollback PR; if not, escalate to operator via
  `requireHumanIntervention` impulse.
- [ ] 6.3 Rollback PR goes through the same `verify-merge-candidate` +
  `gitMergePR` gate. Rollback is not privileged; it is just another
  self-deployment.
- [ ] 6.4 Repeated rollbacks for the same activity / change kind
  trigger `safety_breach.breach_type: "rollback_loop"`; the
  underlying change kind is added to operator-approval-required
  list.

## Phase 7 — Whitelist scope-limit

- [ ] 7.1 New shape `selfDeploymentWhitelist` (read) — body
  `{ allowed_change_kinds: [...] }`.
- [ ] 7.2 Initial allowed_change_kinds (first 90 days):
  - `distilled-resolver-registration`
  - `spec-proposal-merge`
  - `docs-update`
  - `activity-template-addition`
- [ ] 7.3 `author-pr` activity verifies the candidate change's
  classified kind is whitelisted. Non-whitelisted → refusal with
  `safety_breach.breach_type: "self_deployment_scope"`.
- [ ] 7.4 After 90 days of stable self-deployment (≤2 operator
  rollback interventions on 30+ self-deployed merges), substrate
  may propose whitelist expansion via standard `propose-spec` flow.
  Operator-reviewed per §27.3.c.

## Phase 8 — Disagreement tracking

- [ ] 8.1 GitHub Actions and substrate `verify-merge-candidate` run
  in parallel on every self-authored PR.
- [ ] 8.2 Disagreement events emit `verifierDisagreement` impulses.
  Body: `{ pr_id, gh_actions_verdict, substrate_verdict, divergent_signals }`.
- [ ] 8.3 Disagreement rate tracked weekly; ≥5% triggers
  operator review.

## Phase 9 — IAL integration

- [ ] 9.1 Amend IAL §27.3.j.6 to require not just substrate-authored
  proposals but substrate-merged self-deployments. New criterion:
  ≥30 substrate-authored merges within 90 days with <2 rollbacks.
- [ ] 9.2 Amend IAL §27.S.1 to reference the strengthened criterion.
- [ ] 9.3 Update CLAUDE.md "Development Loop" section: post-lift
  loop step 1 (edit vessel source) becomes substrate-authored;
  step 2-4 already substrate-mediated; step 5 (deploy via /deploy)
  becomes substrate-self-deployment.

## Phase 10 — Canary validation

- [ ] 10.1 Deploy with whitelist active and operator-approval required
  for first merge.
- [ ] 10.2 First substrate-authored merged PR within 2 weeks.
- [ ] 10.3 Cumulative 30 substrate-authored merges within 90 days.
- [ ] 10.4 Deliberate-regression test: seed a candidate change
  that introduces a measurable regression; verify rollback fires
  within 1 hour.
- [ ] 10.5 Disagreement-rate measured weekly; ≤5% on routine
  changes.
