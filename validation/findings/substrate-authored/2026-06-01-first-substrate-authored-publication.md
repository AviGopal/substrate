# First substrate-authored publication via composition

**Date:** 2026-06-01
**Branch:** substrate-authored/2026-06-01-first-substrate-merge-0326
**Composition:** development-vessel:publish-substrate-authored-artifact

This file was written to a writable super-repo clone inside the substrate
container at `/workspace/git/super-repo/` by the substrate's `fs_write`
resolver, dispatched as one of seven tasks in the
`publish-substrate-authored-artifact` activity composition. The remaining
six tasks (`git_status`, `git_branch_create`, `git_add`, `git_commit`,
`git_push`, `gh_pr_create`) were dispatched against the substrate's own
dev-vessel resolvers - each enforcing its own safety constraint
(branch-prefix allowlist, protected-branch refusal, provenance-trailer
requirement).

The end-to-end chain has no operator script. The path inside the super-
repo was chosen at composition-dispatch time as a variable (`target_path`).
A future substrate-authored vessel publishes to `repos/<that-vessel>/`
by setting the same variable; nothing in the resolvers or the activity
needs to change.

## Concept-db / impulses / activities / variants - the closed loop

1. `concept-db` priors fed the drafter's vocabulary when this content was
   authored. The cited concepts anchored the meta-recursive reasoning
   (substrate authoring documentation of substrate authoring).
2. The artifact entered the system as an `authoredArtifactCandidate`
   impulse with body containing target_path and content.
3. The `publish-substrate-authored-artifact` activity composition
   (a variant of the substrate-as-git-author Phase 1 publication family)
   dispatched its 7-task sequence.
4. Each task emitted a result impulse - `commandResult`,
   `branchCreateResult`, `gitPushResult`, `prCreateResult` - all of which
   landed in the activity-api trace store with the composition's chain
   provenance.
5. Operator review + merge advance `origin/dev`. Once merged, the trace's
   success status updates Thompson posteriors for the composition family,
   the comprehensibility check observes the merged content, and the
   ribosome can extract derivable patterns into future activity variants.

## Status of this iteration

- Resolvers `git_branch_create`, `git_push`, `gh_pr_create` shipped:
  dev-vessel `873950c`, super-repo `301ee7fb`.
- Writable super-repo clone at `/workspace/git/super-repo` (HTTPS-with-
  token remote, substrate-live git identity).
- `GH_TOKEN` and `GITHUB_TOKEN` injected into `/etc/substrate/env` for
  dev-vessel.
- `publish-substrate-authored-artifact` template seeded into activity-api.
- This file is the substrate's first artifact published via this chain.

## Substrate-Authored-By

substrate-live (vessel identity TBD pending H2 - see
`openspec/changes/2026-06-01-substrate-as-git-author/`).

The Substrate-Authored-By trailer in the commit message and PR body is
required by the `gh_pr_create` resolver's safety gate; without it,
publication is refused with `safety_breach`. Operator credentials carry
the git author identity until H2-derived ed25519 signing ships.
