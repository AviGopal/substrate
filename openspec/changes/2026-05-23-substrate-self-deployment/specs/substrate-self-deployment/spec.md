# Capability: substrate-self-deployment

## Definition

The substrate writes commits to its source repository, opens PRs,
runs its own `verify-merge-candidate` activity (§27.3.j.4) as the
authoritative merge gate, performs the merge, and dispatches a
`restart-vessel` activity to load the new code. The path is
substrate-resident: operator git CLI access is not consulted during
routine self-deployment. Operator retains git access at all times per
§27.3.c; closure does not remove operator capability, it removes
operator necessity.

A substrate-resident git identity (`metabob-substrate-bot`) holds the
substrate's commit authorship credential. PRs carry an
`authored_by: substrate-self-deployment` frontmatter to mark
provenance. Substrate-authored merges respect a whitelist of "safe"
change kinds during a 90-day initial window; the whitelist expands via
standard operator-reviewed `propose-spec` proposals.

## Shapes

- `gitClone`, `gitCommit`, `gitPush`, `gitOpenPR`, `gitMergePR`,
  `gitRead` — write shapes resolved by development-vessel; back-end
  shells out to `git` / `gh` via local-tools-vessel.
- `prAuthored` (write, emitted by `author-pr`) — body
  `{ pr_id, pr_url, branch_name, source_candidate_change_ref }`.
- `prMerged` (write, emitted by `gitMergePR`) — body
  `{ pr_id, merge_commit_sha, affected_vessels[] }`.
- `selfDeploymentSucceeded` / `selfDeploymentFailed` (write) — emitted
  after post-merge restart health check.
- `selfDeploymentWhitelist` (read) — body
  `{ allowed_change_kinds: [...] }`.
- `verifierDisagreement` (write) — body
  `{ pr_id, gh_actions_verdict, substrate_verdict, divergent_signals }`.

## Pipeline

```
candidateChangeSet impulse
  ↓
author-pr activity (gitClone → apply → gitCommit → gitPush → gitOpenPR)
  ↓
prAuthored impulse
  ↓
verify-merge-candidate activity (§27.3.j.4) runs in parallel with GitHub Actions
  ↓
mergeVerdict impulse
  ↓
gitMergePR resolver gates on mergeVerdict.verdict == "pass"
  ↓
prMerged impulse
  ↓
lifecycle subscriber dispatches restart-vessel (§27.3.j.5)
  ↓
30s health check
  ↓
selfDeploymentSucceeded OR selfDeploymentFailed → revert-self-deployed-change
```

## Self-application invariants

1. **Foundation alignment** — git operations are resolvers; the source
   repository is a remote resource. The substrate operates *on* the
   remote, not as the source of truth.
2. **Closure-bound** — every stage substrate-resident.
   `closure-audit --without=operator-shell` covers self-deployment.
3. **Confidence-weighted** — self-deployed changes that produce
   regressions cause posterior updates against the authoring activity.
4. **Cost-weighted** — git operations near-zero cost; verifier
   evaluation cost dominates. Cost-weighted Thompson selects the
   cheapest sufficient verifier configuration.
5. **Recursion bounded** — self-deployment machinery is itself
   modifiable by self-deployment, but deployment-mechanism changes
   require operator approval per §27.3.c.1 admin scope. The recursion
   has an explicit floor.
6. **Verifier is itself deployable** — improvements to
   `verify-merge-candidate` can be self-deployed, verified by the
   prior verifier. Each verifier version anchors at the previous
   version. The bootstrap chain roots at operator-deployed initial
   verifier.
7. **Whitelist guards risky changes** — a scoped initial whitelist
   keeps early self-deployment to changes that are easy to roll
   back. Whitelist expansion follows operator review.

## Whitelist

Initial allowed_change_kinds (first 90 days):

- `distilled-resolver-registration` — new files in
  `repos/<vessel>/distilled/` per distillation sibling spec.
- `spec-proposal-merge` — markdown-only changes under `openspec/`.
- `docs-update` — markdown changes under `docs/`.
- `activity-template-addition` — new templates added; no replacements.

Non-whitelisted change kinds (require operator approval):

- Vessel code modifications (`repos/<vessel>/src/*.ts`).
- Schema migrations (`repos/metabob-activity-api/sql/migrations/`).
- Substrate-explicit-vessels modifications (`scripts/substrate/units/`).
- Deployment mechanism modifications (this capability's own code).
- CLAUDE.md changes (operator authority document).

Whitelist expansion: after ≤2 rollbacks across 30+ self-deployed
merges in 90 days, substrate may propose whitelist expansion via
standard `propose-spec` flow. Operator reviews per §27.3.c.

## Rollback

`revert-self-deployed-change` activity:

1. Spawns a fork via substrate-forge-vessel with the revert applied.
2. Fork runs 30min evaluation; emits `forkOutcome`.
3. On success, opens a revert PR through the standard `author-pr` flow.
4. Revert PR goes through the same `verify-merge-candidate` +
   `gitMergePR` gate.
5. Repeated rollbacks for the same change kind trigger
   `safety_breach.breach_type: "rollback_loop"`; the change kind
   is added to operator-approval-required list.

## Disagreement tracking

GitHub Actions remains the operator-visible CI. Substrate
`verify-merge-candidate` is the authoritative gate. Disagreements
emit `verifierDisagreement` impulses; weekly aggregate disagreement
rate is observable. Rates ≥5% trigger operator review (substrate's
verifier may be drifting; or GH Actions may be miscalibrated).

## Acceptance

1. **First substrate-authored merged PR** within 2 weeks of
   deployment.
2. **30 cumulative self-deployed merges** within 90 days, ≤2
   rollbacks.
3. **Whitelist enforced**: a non-whitelisted change attempt is
   rejected with `safety_breach.breach_type: "self_deployment_scope"`.
4. **Rollback functional**: deliberate-regression test triggers
   rollback within 1 hour.
5. **Self-restart**: post-merge `restart-vessel` completes within
   60s with health check passing.
6. **Disagreement-rate**: ≤5% on routine changes after 4 weeks.
7. **Closure**: `closure-audit --without=operator-shell` zero
   failures for self-deployment.

## Status

Last of the five post-lift acceleration mechanisms. Depends on
substrate-closure-properties (§27.3.j.4 CI closure + §27.3.j.5 self-
healing), substrate-forge-vessel (rollback fork), and
llm-to-deterministic-distillation (whitelisted change kind for the
first cohort of self-deployed merges). Lands after the prior four
acceleration specs have stable canary metrics.
