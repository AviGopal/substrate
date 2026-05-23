# Proposal: Substrate Self-Deployment

## Why

§27.3.j.6 (closure for spec-authoring) requires three accepted spec
proposals with substrate-authored provenance. That captures the
*authoring* half of the development loop. The committed
`substrate-closure-properties` spec also names §27.3.j.4 (CI closure
— substrate harness as merge authority) and §27.3.j.5 (self-healing
closure — substrate-dispatched restart / restore activities). What
sits between these — and is not yet closed — is the **deployment**
half: the substrate writing commits, opening PRs, merging them through
its own CI-closure verdict, and triggering its own `restart-vessel`
to load the new code.

Today, every code change requires operator git access. Even with
substrate-authored proposals and substrate-run verification, the merge
step is an operator action. The substrate can recommend changes but
cannot ship them. Lift criterion 7 ("the substrate sustains its own
topology-discovery loop without external developer input") requires
the substrate to ship its own changes, with operator retaining
unforeseeable-failure override per §27.3.c.

This change closes that loop. Substrate-resident git authorship +
substrate-resident PR opening + substrate-resident merging gated by
the §27.3.j.4 CI-closure verdict. Combined with substrate-forge-vessel
(variant verification) and substrate-closure-properties (verifier
authority), the deployment step becomes "promote the winning fork's
git state to the canonical substrate via a substrate-authored PR".

## Self-application

Self-deployment is the most consequential of the post-lift mechanisms;
it is also the one most subject to its own conditions:

- **Foundation alignment** — git authorship, PR opening, and merging
  are all resolver operations. Source-of-truth (the git repository) is
  *external* to the substrate (lives in operator-controlled
  infrastructure); the substrate operates *on* it as a remote
  resource. This is structurally fine: the operator-controlled git
  remote is the trust anchor for the substrate's source code, analogous
  to identity-vessel being the trust anchor for credentials.
- **Closure** — the deployment path is substrate-resident. The
  substrate writes commits, opens PRs, merges them, restarts itself.
  Operator git CLI access is not consulted during routine self-
  deployment.
- **Confidence weighting** — self-deployment outcomes are observable
  through standard trace mechanisms. A self-deployed change that
  produces regressions on canary causes posterior updates against the
  authoring activity.
- **Cost weighting** — git operations are near-zero cost; merge gate
  evaluation cost dominates. Cost-weighted Thompson selects the
  cheapest sufficient verification path.
- **Recursive self-deployment** — the substrate's deployment
  mechanism is itself code that may be modified by self-deployment.
  This creates a bootstrap concern: a buggy self-deployment change
  could break self-deployment itself. Mitigation: deployment changes
  require operator review per §27.3.c.1 (admin scope mutations) even
  after general self-deployment is enabled. The recursion is
  acknowledged and bounded.
- **The verifier is itself deployable** — the §27.3.j.4 verifier
  (verify-merge-candidate activity) can be improved by self-deployment.
  Bootstrap chain: operator-deployed initial verifier → first
  self-deployed verifier change verified by prior verifier → and so
  on. Each verifier version anchors at the previous version, all
  rooted at the operator-deployed initial.

## What Changes

1. **Git resolver vessel extension**: `development-vessel` (or a new
   thin `git-vessel`) advertises shapes for git operations:
   - `gitClone` (write, scoped to the substrate's source repos)
   - `gitCommit` (write) — body
     `{ branch, files, message, author_identity }`
   - `gitPush` (write) — body `{ branch, remote }`
   - `gitOpenPR` (write) — body
     `{ title, body, base_branch, head_branch }`
   - `gitMergePR` (write, gated on §27.3.j.4 verdict) — body
     `{ pr_id, verdict_ref }`
   - `gitRead` (read) — for inspecting current state
2. **Substrate git identity**: a substrate-scoped git identity
   (`metabob-substrate-bot <noreply@metabob.com>` or similar) committed
   from identity-vessel. The identity holds an SSH key minted at
   substrate boot, registered with the remote repo's authorized
   keys. Identity rotation is operator-controlled per §27.3.c.1.
3. **Substrate PR-authoring activity**: `author-pr` activity takes a
   `candidateChangeSet` impulse (from `propose-spec` per
   §27.3.j.6, or from `distillation-promotion` per the distillation
   sibling), produces the necessary commits, opens a PR with
   `authored_by: substrate-self-deployment` frontmatter.
4. **Merge gate**: `gitMergePR` resolver requires a positive
   `mergeVerdict` impulse from `verify-merge-candidate` (§27.3.j.4)
   referenced in the request body. Missing or negative verdict →
   refusal with `verifier_negative`.
5. **Substrate-orchestrated CI**: GitHub Actions remains the operator-
   visible CI; substrate's own `verify-merge-candidate` is the
   *authoritative* gate. GitHub Actions can disagree (substrate
   verdict wins, but disagreement is logged). Disagreement rate is
   itself a signal feeding the verifier's posteriors.
6. **Post-merge self-restart**: after `gitMergePR` succeeds and the
   merged commit lands on the dev branch, a `restart-vessel` activity
   (per §27.3.j.5) is dispatched to load the new code. The substrate
   restarts itself.
7. **Rollback path**: a `revert-self-deployed-change` activity
   reverts a recent self-deployed commit if post-restart vessel
   health degrades. Substrate-forge runs a pre-restart fork as a
   safety check.
8. **Self-deployment scope-limit**: the first 90 days of self-deployment
   are restricted to a whitelist of "safe" change kinds:
   - Distilled resolver registrations (new files in `distilled/`)
   - Spec proposal merges (markdown only)
   - Documentation updates
   - Activity template additions (no replacements)
   Riskier change kinds (vessel code modifications, schema
   migrations, substrate-explicit-vessels modifications, deployment
   mechanism modifications) require operator approval until the
   first 90 days demonstrate stable self-deployment.

## Success criteria

1. **First substrate-authored merged PR**: within 2 weeks of
   deployment, a substrate-authored PR is merged through the
   substrate's own verify-merge-candidate gate without operator
   intervention.
2. **Self-restart verified**: after a substrate-authored merge,
   the substrate dispatches its own restart-vessel and loads the new
   code; the restart completes successfully within 60s.
3. **Whitelist enforced**: an attempted self-deployment of a
   non-whitelisted change kind (e.g., vessel code modification) is
   refused with `safety_breach.breach_type: "self_deployment_scope"`.
4. **Rollback functional**: deliberate-regression test —
   self-deploy a change that introduces a regression detectable by
   harness; substrate auto-reverts within 1 hour.
5. **Disagreement-rate trackable**: GitHub Actions vs substrate
   verify-merge-candidate disagreement rate observable; ≤5% on
   routine changes.
6. **30 cumulative self-deployed changes** within 90 days, with
   <2 requiring operator rollback intervention.
7. **Closure**: `closure-audit --without=operator-shell` zero
   failures for self-deployment.

## Capabilities

### New Capabilities

- `substrate-self-deployment` — git resolver vessel extension;
  substrate git identity; PR-authoring activity; merge gate
  conditional on §27.3.j.4 verdict; post-merge self-restart; rollback
  path; whitelist scope-limit. Spec:
  `specs/substrate-self-deployment/spec.md`.

### Modified Capabilities

- `development-vessel` advertises git shapes.
- `identity-vessel` issues substrate git SSH key + git identity.
- IAL Phase 27.3.j.6 (spec-authoring closure) extends to require
  substrate self-merging via this spec.
- IAL Phase 27.S.1 (lift acceptance) gate: ≥30 substrate-authored
  merges within 90 days with <2 rollbacks. Replaces the bare
  "≥3 substrate-authored proposals" criterion from
  closure-properties when this spec ships.

## Dependencies

- `2026-05-23-substrate-closure-properties` (committed) —
  §27.3.j.4 (CI closure) and §27.3.j.5 (self-healing) are required.
- `2026-05-23-substrate-forge-vessel` (sibling) — pre-restart fork
  safety check.
- `2026-05-23-llm-to-deterministic-distillation` (sibling) —
  distilled-resolver registrations are the canonical first kind of
  whitelisted self-deployment.

## Out of scope

- **Multi-substrate self-deployment**. A self-deployment that
  propagates across federated substrates is H6 / federation work.
- **Self-deployment of deployment mechanism**. The deployment
  machinery itself is operator-controlled forever (per §27.3.c.1
  admin scope), even after general self-deployment is enabled.
  Bootstrap and trust-root protection.
- **Operator override removal**. Operator retains shell access and
  git access at all times per §27.3.c. Closure does not mean
  removal of operator capability; it means substrate operates
  without operator necessity.
- **Cross-repo self-deployment**. Initially scoped to the substrate's
  own `metabob-devbob` super-repo. Per-vessel sub-repos are out of
  scope; vessel changes go through standard
  develop-vessel-via-substrate-forge path.
